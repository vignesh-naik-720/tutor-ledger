import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAuditEvent } from '../audit/auditWriter.js';
import { query } from '../db/client.js';
import {
  ApiError,
  loadLedger,
  parseId,
  parseOrThrow,
  type ApiDeps,
} from '../http/apiCommon.js';
import { decryptField, encryptField } from '../security/fieldCrypto.js';
import { normalisePhone } from '../validation/phone.js';
import { moneyMinorSchema } from '../validation/index.js';

// Family routes (T039): GET/POST/PATCH /families. Ledger comes from the session (request.ledgerId).
// Name and phone are [ENC] fields; the phone is returned masked in every response.

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((s) => !CONTROL_CHARS.test(s), 'control');
const toneSchema = z.enum(['friendly', 'neutral', 'firm']);
const termSchema = z.number().int().min(0).max(365);

const familyCreateSchema = z
  .object({
    name: nameSchema,
    phone: z.string().max(40),
    default_fee_minor: moneyMinorSchema.min(0).optional(),
    default_term_days: termSchema.optional(),
    default_tone: toneSchema.optional(),
  })
  .strict();

const familyPatchSchema = z
  .object({
    name: nameSchema.optional(),
    phone: z.string().max(40).optional(),
    default_fee_minor: moneyMinorSchema.min(0).optional(),
    default_term_days: termSchema.optional(),
    default_tone: toneSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'empty');

interface FamilyRow {
  id: string;
  name_ct: Buffer;
  phone_ct: Buffer;
  phone_digits_hash: Buffer;
  default_fee_minor: string | number;
  default_term_days: number;
  default_tone: string;
  avg_delay_days: string | null;
  payment_count: number;
}

function maskPhone(e164: string): string {
  return `+•••••${e164.slice(-4)}`;
}

function phoneHash(e164: string, key: string): Buffer {
  return createHmac('sha256', key).update(e164).digest();
}

function toView(row: FamilyRow, name: string, e164: string) {
  return {
    id: row.id,
    name,
    phone_masked: maskPhone(e164),
    default_fee_minor: Number(row.default_fee_minor),
    default_term_days: row.default_term_days,
    default_tone: row.default_tone,
    avg_delay_days: row.avg_delay_days === null ? null : Number(row.avg_delay_days),
    payment_count: row.payment_count,
  };
}

function requireE164(raw: string): string {
  const e164 = normalisePhone(raw);
  if (!e164) throw new ApiError(400, 'VALIDATION_FAILED', [{ path: 'phone', rule: 'e164' }]);
  return e164;
}

const SELECT_FAMILY = `SELECT id, name_ct, phone_ct, phone_digits_hash, default_fee_minor, default_term_days,
  default_tone, avg_delay_days, payment_count
  FROM family WHERE id = $1 AND ledger_id = $2`;

export async function familyRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get('/families', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const ledger = await loadLedger(ledgerId);
    const rows = await query<FamilyRow>(
      `SELECT id, name_ct, phone_ct, phone_digits_hash, default_fee_minor, default_term_days,
              default_tone, avg_delay_days, payment_count
         FROM family WHERE ledger_id = $1 ORDER BY created_at, id`,
      [ledgerId],
    );
    const families = rows.map((row) => {
      const name = decryptField(deps.fieldKey, row.name_ct, row.id, 'name_ct');
      const e164 = decryptField(deps.fieldKey, row.phone_ct, row.id, 'phone_ct');
      return toView(row, name, e164);
    });
    return reply.send({ currency_code: ledger.currency_code, families });
  });

  app.post('/families', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(familyCreateSchema, request.body);
    const e164 = requireE164(body.phone);
    const id = randomUUID();
    const digestHash = phoneHash(e164, deps.phoneHmacKey);

    // Duplicate phone is warned about, never silently merged (data-model.md Family).
    const dupes = await query<{ id: string }>(
      'SELECT id FROM family WHERE ledger_id = $1 AND phone_digits_hash = $2 LIMIT 1',
      [ledgerId, digestHash],
    );

    const feeMinor = body.default_fee_minor ?? 0;
    const termDays = body.default_term_days ?? 0;
    const tone = body.default_tone ?? 'neutral';

    await query(
      `INSERT INTO family (id, ledger_id, name_ct, phone_ct, phone_digits_hash,
                           default_fee_minor, default_term_days, default_tone, is_sample_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)`,
      [
        id,
        ledgerId,
        encryptField(deps.fieldKey, body.name, id, 'name_ct'),
        encryptField(deps.fieldKey, e164, id, 'phone_ct'),
        digestHash,
        feeMinor,
        termDays,
        tone,
      ],
    );
    await writeAuditEvent(
      { ledgerId, actor: 'owner', actionCode: 'FAMILY_CREATED', subjectType: 'family', subjectId: id },
      deps.auditHmacKey,
    );

    const created = await query<FamilyRow>(SELECT_FAMILY, [id, ledgerId]);
    const row = created[0];
    if (!row) throw new ApiError(500, 'INTERNAL');
    return reply.code(201).send({
      family: toView(row, body.name, e164),
      duplicate_phone: dupes.length > 0,
    });
  });

  app.patch('/families/:id', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const id = parseId((request.params as { id?: unknown }).id);
    const body = parseOrThrow(familyPatchSchema, request.body);

    const rows = await query<FamilyRow>(SELECT_FAMILY, [id, ledgerId]);
    const current = rows[0];
    if (!current) throw new ApiError(404, 'NOT_FOUND');

    const currentName = decryptField(deps.fieldKey, current.name_ct, id, 'name_ct');
    const currentE164 = decryptField(deps.fieldKey, current.phone_ct, id, 'phone_ct');
    const name = body.name ?? currentName;
    const e164 = body.phone !== undefined ? requireE164(body.phone) : currentE164;
    const digestHash = body.phone !== undefined ? phoneHash(e164, deps.phoneHmacKey) : current.phone_digits_hash;

    const fee = body.default_fee_minor ?? Number(current.default_fee_minor);
    const term = body.default_term_days ?? current.default_term_days;
    const tone = body.default_tone ?? current.default_tone;

    await query(
      `UPDATE family
          SET name_ct = $3, phone_ct = $4, phone_digits_hash = $5,
              default_fee_minor = $6, default_term_days = $7, default_tone = $8
        WHERE id = $1 AND ledger_id = $2`,
      [
        id,
        ledgerId,
        encryptField(deps.fieldKey, name, id, 'name_ct'),
        encryptField(deps.fieldKey, e164, id, 'phone_ct'),
        digestHash,
        fee,
        term,
        tone,
      ],
    );

    const updated = await query<FamilyRow>(SELECT_FAMILY, [id, ledgerId]);
    const row = updated[0];
    if (!row) throw new ApiError(404, 'NOT_FOUND');
    return reply.send({ family: toView(row, name, e164) });
  });

  app.delete('/families/:id', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const id = parseId((request.params as { id?: unknown }).id);

    const rows = await query<FamilyRow>(SELECT_FAMILY, [id, ledgerId]);
    if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND');

    // Cascade deletion
    await query('DELETE FROM payment WHERE family_id = $1 AND ledger_id = $2', [id, ledgerId]);
    await query('DELETE FROM invoice WHERE family_id = $1 AND ledger_id = $2', [id, ledgerId]);
    await query('DELETE FROM reminder_draft WHERE family_id = $1 AND ledger_id = $2', [id, ledgerId]);
    await query('DELETE FROM family WHERE id = $1 AND ledger_id = $2', [id, ledgerId]);

    await writeAuditEvent(
      {
        ledgerId,
        actor: 'owner',
        actionCode: 'FAMILY_DELETED',
        subjectType: 'family',
        subjectId: id,
        detail: { family_id: id },
      },
      deps.auditHmacKey,
    );

    return reply.send({ status: 'ok', deleted_id: id });
  });
}
