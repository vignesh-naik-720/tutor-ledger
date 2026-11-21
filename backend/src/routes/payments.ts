// Payments routes: record payments, parse pasted messages (FR-017, FR-018, FR-023, FR-024)
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { ApiError, parseId, parseOrThrow, type ApiDeps } from '../http/apiCommon.js';
import { checkPayment, statusAfterPayment } from '../domain/payment.js';
import { parsePaymentMessage } from '../domain/messageParser.js';
import { parsePaymentMessageWithAI } from '../domain/aiAssistant.js';
import { writeAuditEvent } from '../audit/auditWriter.js';
import { moneyMinorSchema, uuidSchema } from '../validation/index.js';
import { decryptField } from '../security/fieldCrypto.js';

const paymentCreateSchema = z
  .object({
    amount_minor: moneyMinorSchema.min(1),
    date_received: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    client_event_id: uuidSchema,
    source: z.enum(['owner_entry', 'confirmed_pasted_message']).default('owner_entry'),
    was_offline: z.boolean().default(false),
    pasted_amount_flagged: z.boolean().default(false),
  })
  .strict();

const parseMessageSchema = z
  .object({
    text: z.string().min(1).max(2000),
    use_ai: z.boolean().default(true),
  })
  .strict();

export async function paymentRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  // GET /invoices/:id/payments
  app.get('/invoices/:id/payments', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const invoiceId = parseId((request.params as { id?: unknown }).id);

    interface PayRow {
      id: string;
      amount_minor: string | number;
      date_received: string;
      source: string;
      was_offline: boolean;
      recorded_at: string;
    }

    const rows = await query<PayRow>(
      `SELECT id, amount_minor, to_char(date_received, 'YYYY-MM-DD') AS date_received,
              source, was_offline, to_char(recorded_at, 'YYYY-MM-DD HH24:MI:SS') AS recorded_at
         FROM payment
        WHERE invoice_id = $1 AND ledger_id = $2
        ORDER BY date_received DESC, recorded_at DESC`,
      [invoiceId, ledgerId],
    );

    return reply.send({
      payments: rows.map((r) => ({
        id: r.id,
        amount_minor: Number(r.amount_minor),
        date_received: r.date_received,
        source: r.source,
        was_offline: r.was_offline,
        recorded_at: r.recorded_at,
      })),
    });
  });

  // POST /invoices/:id/payments (record payment)
  app.post('/invoices/:id/payments', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const invoiceId = parseId((request.params as { id?: unknown }).id);
    const body = parseOrThrow(paymentCreateSchema, request.body);

    // Load invoice
    interface InvRow {
      id: string;
      family_id: string;
      amount_minor: string | number;
      status: string;
    }

    const invRows = await query<InvRow>(
      'SELECT id, family_id, amount_minor, status FROM invoice WHERE id = $1 AND ledger_id = $2',
      [invoiceId, ledgerId],
    );
    const inv = invRows[0];
    if (!inv) throw new ApiError(404, 'NOT_FOUND');

    // Get current paid amount
    const payRows = await query<{ sum: string | number | null }>(
      'SELECT COALESCE(SUM(amount_minor), 0) AS sum FROM payment WHERE invoice_id = $1 AND ledger_id = $2',
      [invoiceId, ledgerId],
    );
    const totalAmount = Number(inv.amount_minor);
    const paidAlready = Number(payRows[0]?.sum ?? 0);
    const remaining = totalAmount - paidAlready;

    // Validate payment rules
    const checkErr = checkPayment({
      amountMinor: body.amount_minor,
      remainingMinor: remaining,
      invoiceStatus: inv.status as any,
      source: body.source,
      amountFlagged: body.pasted_amount_flagged,
    });

    if (checkErr) {
      throw new ApiError(400, 'VALIDATION_FAILED', [{ path: 'amount_minor', rule: checkErr }]);
    }

    // Check idempotency (client_event_id)
    const existing = await query<{ id: string }>(
      'SELECT id FROM payment WHERE ledger_id = $1 AND client_event_id = $2',
      [ledgerId, body.client_event_id],
    );
    if (existing.length > 0) {
      // Replay returns success idempotently (R-1)
      return reply.send({
        status: 'ok',
        payment_id: existing[0]!.id,
        replayed: true,
      });
    }

    const paymentId = randomUUID();
    await query(
      `INSERT INTO payment (id, ledger_id, family_id, invoice_id, client_event_id, amount_minor,
                            date_received, source, was_offline, pasted_amount_flagged)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        paymentId,
        ledgerId,
        inv.family_id,
        invoiceId,
        body.client_event_id,
        body.amount_minor,
        body.date_received,
        body.source,
        body.was_offline,
        body.pasted_amount_flagged,
      ],
    );

    const newRemaining = remaining - body.amount_minor;
    const newStatus = statusAfterPayment(newRemaining);

    await query(
      'UPDATE invoice SET status = $3, updated_at = now() WHERE id = $1 AND ledger_id = $2',
      [invoiceId, ledgerId, newStatus],
    );

    // If fully paid, flag any reminder draft as out of date (FR-026)
    if (newStatus === 'paid') {
      await query(
        'UPDATE reminder_draft SET out_of_date = TRUE WHERE invoice_id = $1 AND ledger_id = $2',
        [invoiceId, ledgerId],
      );
    }

    await writeAuditEvent(
      {
        ledgerId,
        actor: 'owner',
        actionCode: 'PAYMENT_RECORDED',
        subjectType: 'payment',
        subjectId: paymentId,
        detail: { amount_minor: body.amount_minor, new_status: newStatus },
      },
      deps.auditHmacKey,
    );

    return reply.code(201).send({
      payment: {
        id: paymentId,
        invoice_id: invoiceId,
        amount_minor: body.amount_minor,
        date_received: body.date_received,
        new_invoice_status: newStatus,
        remaining_minor: newRemaining,
      },
    });
  });

  // POST /payments/parse-message (writes NOTHING; parses text to draft)
  app.post('/payments/parse-message', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(parseMessageSchema, request.body);

    // Get ledger currency exponent
    const ledgers = await query<{ currency_exponent: number }>('SELECT currency_exponent FROM ledger WHERE id = $1', [
      ledgerId,
    ]);
    const exp = ledgers[0]?.currency_exponent ?? 2;

    // Load family names for candidate matching
    const families = await query<{ id: string; name_ct: Buffer }>(
      'SELECT id, name_ct FROM family WHERE ledger_id = $1',
      [ledgerId],
    );
    const familyNames = families.map((f) => {
      try {
        return decryptField(deps.fieldKey, f.name_ct, f.id, 'name_ct');
      } catch {
        return '';
      }
    }).filter(Boolean);

    // If AI is requested, invoke our AI parser
    const apiKey = process.env.GEMINI_API_KEY;
    const aiResult = await parsePaymentMessageWithAI(body.text, exp, familyNames, apiKey);

    // Also verify with bounded pure parser
    const pureResult = parsePaymentMessage(body.text, exp);

    return reply.send({
      draft: {
        amount_minor: aiResult.amount_minor ?? (pureResult.ok ? pureResult.draft.amount_minor : null),
        date: aiResult.date ?? (pureResult.ok ? pureResult.draft.date : null),
        amount_flagged: aiResult.amount_flagged,
        confidence: aiResult.confidence,
        family_candidate: aiResult.family_name_candidate,
        payment_mode: aiResult.payment_mode,
        reference_id: aiResult.reference_id,
        is_partial: aiResult.is_partial,
        raw_summary: aiResult.raw_summary,
        suggested_notes: aiResult.suggested_notes,
      },
    });
  });
}
