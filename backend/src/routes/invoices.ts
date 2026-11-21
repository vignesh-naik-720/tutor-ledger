import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAuditEvent } from '../audit/auditWriter.js';
import { query } from '../db/client.js';
import { ApiError, loadLedger, parseId, parseOrThrow, type ApiDeps } from '../http/apiCommon.js';
import { canVoid, validateInvoiceFields, versionMatches, type InvoiceStatus } from '../domain/invoice.js';
import { addDays } from '../domain/invoiceGenerate.js';
import { uuidSchema } from '../validation/index.js';
import { decryptField } from '../security/fieldCrypto.js';

// Invoice routes (T042): create, confirm and void. Ledger comes from the session. Money is taken
// from the family's saved defaults, never from the request body.

const versionSchema = z.number().int().min(1);

const invoiceCreateSchema = z
  .object({
    family_id: uuidSchema,
    client_event_id: uuidSchema,
  })
  .strict();

const invoiceConfirmSchema = z
  .object({
    client_event_id: uuidSchema,
    version: versionSchema,
  })
  .strict();

const invoiceVoidSchema = z
  .object({
    version: versionSchema,
  })
  .strict();

interface InvoiceRow {
  id: string;
  family_id: string;
  period_start: string;
  period_end: string;
  amount_minor: string | number;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  version: number;
}

const SELECT_INVOICE = `SELECT id, family_id,
    to_char(period_start, 'YYYY-MM-DD') AS period_start,
    to_char(period_end, 'YYYY-MM-DD') AS period_end,
    amount_minor,
    to_char(issue_date, 'YYYY-MM-DD') AS issue_date,
    to_char(due_date, 'YYYY-MM-DD') AS due_date,
    status, version
  FROM invoice WHERE id = $1 AND ledger_id = $2`;

function toView(row: InvoiceRow, currencyCode: string | null) {
  return {
    id: row.id,
    family_id: row.family_id,
    period_start: row.period_start,
    period_end: row.period_end,
    amount_minor: Number(row.amount_minor),
    issue_date: row.issue_date,
    due_date: row.due_date,
    status: row.status,
    version: row.version,
    currency_code: currencyCode,
  };
}

/** Today's business date in the ledger timezone (data-model.md; research R-6). UTC if unset. */
function ownerToday(timezone: string | null, now = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone ?? 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
}

export async function invoiceRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.post('/invoices', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(invoiceCreateSchema, request.body);
    const ledger = await loadLedger(ledgerId);

    const famRows = await query<{ default_fee_minor: string | number; default_term_days: number }>(
      'SELECT default_fee_minor, default_term_days FROM family WHERE id = $1 AND ledger_id = $2',
      [body.family_id, ledgerId],
    );
    const family = famRows[0];
    if (!family) throw new ApiError(404, 'NOT_FOUND');

    const issueDate = ownerToday(ledger.owner_timezone);
    const dueDate = addDays(issueDate, family.default_term_days);
    const amountMinor = Number(family.default_fee_minor);
    const ruleError = validateInvoiceFields({
      periodStart: issueDate,
      periodEnd: issueDate,
      amountMinor,
      issueDate,
      dueDate,
    });
    if (ruleError) throw new ApiError(400, 'VALIDATION_FAILED', [{ path: 'family_id', rule: ruleError }]);

    const id = randomUUID();
    try {
      // One confirmation creates the invoice as open (data-model.md Invoice state transitions).
      await query(
        `INSERT INTO invoice (id, ledger_id, family_id, period_start, period_end, amount_minor,
                              issue_date, due_date, status, version, is_sample_data)
         VALUES ($1, $2, $3, $4, $4, $5, $4, $6, 'open', 1, FALSE)`,
        [id, ledgerId, body.family_id, issueDate, amountMinor, dueDate],
      );
    } catch (err) {
      // UNIQUE (ledger_id, family_id, period_start): one invoice per family per period (FR-022).
      if ((err as { code?: string }).code === '23505') throw new ApiError(409, 'CONFLICT');
      throw err;
    }
    await writeAuditEvent(
      { ledgerId, actor: 'owner', actionCode: 'INVOICE_CREATED', subjectType: 'invoice', subjectId: id },
      deps.auditHmacKey,
    );

    const rows = await query<InvoiceRow>(SELECT_INVOICE, [id, ledgerId]);
    const row = rows[0];
    if (!row) throw new ApiError(500, 'INTERNAL');
    return reply.code(201).send({ invoice: toView(row, ledger.currency_code) });
  });

  app.post('/invoices/:id/confirm', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const id = parseId((request.params as { id?: unknown }).id);
    const body = parseOrThrow(invoiceConfirmSchema, request.body);
    const ledger = await loadLedger(ledgerId);

    const rows = await query<InvoiceRow>(SELECT_INVOICE, [id, ledgerId]);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'NOT_FOUND');
    if (row.status !== 'due-awaiting-confirmation') throw new ApiError(409, 'CONFLICT');
    if (!versionMatches(row.version, body.version)) throw new ApiError(409, 'CONFLICT');

    const updated = await query<{ id: string }>(
      `UPDATE invoice SET status = 'open', version = version + 1, updated_at = now()
        WHERE id = $1 AND ledger_id = $2 AND version = $3 AND status = 'due-awaiting-confirmation'
        RETURNING id`,
      [id, ledgerId, body.version],
    );
    if (updated.length === 0) throw new ApiError(409, 'CONFLICT');

    await writeAuditEvent(
      { ledgerId, actor: 'owner', actionCode: 'INVOICE_CONFIRMED', subjectType: 'invoice', subjectId: id },
      deps.auditHmacKey,
    );
    const fresh = await query<InvoiceRow>(SELECT_INVOICE, [id, ledgerId]);
    const next = fresh[0];
    if (!next) throw new ApiError(404, 'NOT_FOUND');
    return reply.send({ invoice: toView(next, ledger.currency_code) });
  });

  app.post('/invoices/:id/void', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const id = parseId((request.params as { id?: unknown }).id);
    const body = parseOrThrow(invoiceVoidSchema, request.body);
    const ledger = await loadLedger(ledgerId);

    const rows = await query<InvoiceRow>(SELECT_INVOICE, [id, ledgerId]);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'NOT_FOUND');

    const payCount = await query<{ n: string | number }>(
      'SELECT COUNT(*) AS n FROM payment WHERE invoice_id = $1 AND ledger_id = $2',
      [id, ledgerId],
    );
    // Void is blocked once any payment exists (data-model.md Invoice state transitions).
    if (!canVoid(row.status, Number(payCount[0]?.n ?? 0))) throw new ApiError(409, 'CONFLICT');
    if (!versionMatches(row.version, body.version)) throw new ApiError(409, 'CONFLICT');

    const updated = await query<{ id: string }>(
      `UPDATE invoice SET status = 'void', version = version + 1, updated_at = now()
        WHERE id = $1 AND ledger_id = $2 AND version = $3 AND status = $4
        RETURNING id`,
      [id, ledgerId, body.version, row.status],
    );
    if (updated.length === 0) throw new ApiError(409, 'CONFLICT');

    await writeAuditEvent(
      { ledgerId, actor: 'owner', actionCode: 'INVOICE_VOIDED', subjectType: 'invoice', subjectId: id },
      deps.auditHmacKey,
    );
    const fresh = await query<InvoiceRow>(SELECT_INVOICE, [id, ledgerId]);
    const next = fresh[0];
    if (!next) throw new ApiError(404, 'NOT_FOUND');
    return reply.send({ invoice: toView(next, ledger.currency_code) });
  });

  app.get('/invoices', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const ledger = await loadLedger(ledgerId);

    interface RawInv {
      id: string;
      family_id: string;
      period_start: string;
      period_end: string;
      amount_minor: string | number;
      issue_date: string;
      due_date: string;
      status: InvoiceStatus;
      version: number;
      name_ct: Buffer;
    }

    const rows = await query<RawInv>(
      `SELECT i.id, i.family_id,
              to_char(i.period_start, 'YYYY-MM-DD') AS period_start,
              to_char(i.period_end, 'YYYY-MM-DD') AS period_end,
              i.amount_minor,
              to_char(i.issue_date, 'YYYY-MM-DD') AS issue_date,
              to_char(i.due_date, 'YYYY-MM-DD') AS due_date,
              i.status, i.version, f.name_ct
         FROM invoice i
         JOIN family f ON i.family_id = f.id
        WHERE i.ledger_id = $1
        ORDER BY i.due_date DESC`,
      [ledgerId],
    );

    const payRows = await query<{ invoice_id: string; sum: string | number }>(
      'SELECT invoice_id, COALESCE(SUM(amount_minor), 0) AS sum FROM payment WHERE ledger_id = $1 GROUP BY invoice_id',
      [ledgerId],
    );
    const paidMap = new Map<string, number>();
    for (const p of payRows) {
      paidMap.set(p.invoice_id, Number(p.sum));
    }

    const invoices = rows.map((r) => {
      let familyName = 'Family';
      try {
        familyName = decryptField(deps.fieldKey, r.name_ct, r.family_id, 'name_ct');
      } catch {}
      const paid = paidMap.get(r.id) ?? 0;
      const total = Number(r.amount_minor);
      return {
        ...toView(r, ledger.currency_code),
        family_name: familyName,
        paid_minor: paid,
        remaining_minor: Math.max(0, total - paid),
      };
    });

    return reply.send({ invoices, currency_code: ledger.currency_code });
  });

  app.get('/invoices/:id', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const id = parseId((request.params as { id?: unknown }).id);
    const ledger = await loadLedger(ledgerId);

    const rows = await query<InvoiceRow>(SELECT_INVOICE, [id, ledgerId]);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'NOT_FOUND');

    const payRows = await query<{ sum: string | number }>(
      'SELECT COALESCE(SUM(amount_minor), 0) AS sum FROM payment WHERE invoice_id = $1 AND ledger_id = $2',
      [id, ledgerId],
    );
    const paid = Number(payRows[0]?.sum ?? 0);
    const total = Number(row.amount_minor);

    return reply.send({
      invoice: {
        ...toView(row, ledger.currency_code),
        paid_minor: paid,
        remaining_minor: Math.max(0, total - paid),
      },
    });
  });
}
