// Settings & Export routes (FR-005, FR-012, FR-015, FR-041)
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { decryptField } from '../security/fieldCrypto.js';
import { parseOrThrow, type ApiDeps } from '../http/apiCommon.js';
import { writeAuditEvent } from '../audit/auditWriter.js';
import { moneyMinorSchema } from '../validation/index.js';

const minBalanceSchema = z
  .object({
    minimum_balance_minor: moneyMinorSchema.min(0),
  })
  .strict();

const ledgerSettingsSchema = z
  .object({
    currency_code: z.string().length(3).optional(),
    owner_timezone: z.string().optional(),
    opening_balance_minor: z.number().int().optional(),
    minimum_balance_minor: moneyMinorSchema.min(0).optional(),
  })
  .strict();

export async function settingsRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  // GET /settings
  app.get('/settings', async (request, reply) => {
    const ledgerId = request.ledgerId;
    interface LedRow {
      currency_code: string;
      currency_exponent: number;
      owner_timezone: string;
      minimum_balance_minor: string | number;
      opening_balance_minor: string | number;
      is_sample_data: boolean;
    }
    const rows = await query<LedRow>(
      'SELECT currency_code, currency_exponent, owner_timezone, minimum_balance_minor, opening_balance_minor, is_sample_data FROM ledger WHERE id = $1',
      [ledgerId],
    );
    const led = rows[0];
    return reply.send({
      settings: {
        currency_code: led?.currency_code ?? 'INR',
        currency_exponent: led?.currency_exponent ?? 2,
        owner_timezone: led?.owner_timezone ?? 'Asia/Kolkata',
        minimum_balance_minor: Number(led?.minimum_balance_minor ?? 1000000),
        opening_balance_minor: Number(led?.opening_balance_minor ?? 0),
        is_sample_data: Boolean(led?.is_sample_data),
      },
    });
  });

  // PUT /settings/minimum-balance (FR-041)
  app.put('/settings/minimum-balance', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(minBalanceSchema, request.body);

    await query('UPDATE ledger SET minimum_balance_minor = $2 WHERE id = $1', [
      ledgerId,
      body.minimum_balance_minor,
    ]);

    await writeAuditEvent(
      { ledgerId, actor: 'owner', actionCode: 'CONFIG_CHANGED', subjectType: 'ledger', subjectId: ledgerId },
      deps.auditHmacKey,
    );

    return reply.send({ status: 'ok', minimum_balance_minor: body.minimum_balance_minor });
  });

  // PUT /settings/ledger
  app.put('/settings/ledger', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(ledgerSettingsSchema, request.body);

    if (body.currency_code) {
      await query('UPDATE ledger SET currency_code = $2 WHERE id = $1', [ledgerId, body.currency_code.toUpperCase()]);
    }
    if (body.owner_timezone) {
      await query('UPDATE ledger SET owner_timezone = $2 WHERE id = $1', [ledgerId, body.owner_timezone]);
    }
    if (body.minimum_balance_minor !== undefined) {
      await query('UPDATE ledger SET minimum_balance_minor = $2 WHERE id = $1', [ledgerId, body.minimum_balance_minor]);
    }
    if (body.opening_balance_minor !== undefined) {
      await query('UPDATE ledger SET opening_balance_minor = $2 WHERE id = $1', [ledgerId, body.opening_balance_minor]);
    }

    return reply.send({ status: 'ok' });
  });

  // GET /export (Full Ledger export with decrypted records; FR-005)
  app.get('/export', async (request, reply) => {
    const ledgerId = request.ledgerId;

    const families = await query<any>('SELECT * FROM family WHERE ledger_id = $1', [ledgerId]);
    const decryptedFamilies = families.map((f) => {
      let name = 'Family';
      let phone = '';
      try {
        name = decryptField(deps.fieldKey, f.name_ct, f.id, 'name_ct');
        phone = decryptField(deps.fieldKey, f.phone_ct, f.id, 'phone_ct');
      } catch {}
      return {
        id: f.id,
        name,
        phone,
        default_fee_minor: Number(f.default_fee_minor),
        default_term_days: f.default_term_days,
        default_tone: f.default_tone,
        avg_delay_days: f.avg_delay_days,
      };
    });

    const invoices = await query<any>('SELECT * FROM invoice WHERE ledger_id = $1', [ledgerId]);
    const payments = await query<any>('SELECT * FROM payment WHERE ledger_id = $1', [ledgerId]);
    const bills = await query<any>('SELECT * FROM recurring_bill WHERE ledger_id = $1', [ledgerId]);
    const expenses = await query<any>('SELECT * FROM one_off_expense WHERE ledger_id = $1', [ledgerId]);
    const audit = await query<any>('SELECT id, occurred_at, actor, action_code, subject_type FROM audit_event WHERE ledger_id = $1', [ledgerId]);

    await writeAuditEvent(
      { ledgerId, actor: 'owner', actionCode: 'EXPORT_REQUESTED', subjectType: 'ledger', subjectId: ledgerId },
      deps.auditHmacKey,
    );

    reply.header('Content-Disposition', 'attachment; filename="tutor_ledger_export.json"');
    reply.header('Cache-Control', 'no-store');

    return reply.send({
      exported_at: new Date().toISOString(),
      ledger_id: ledgerId,
      families: decryptedFamilies,
      invoices,
      payments,
      bills,
      expenses,
      audit_events: audit,
    });
  });
}
