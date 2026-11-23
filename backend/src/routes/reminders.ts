// Reminder Drafts & wa.me Hand-off (FR-020, FR-025, FR-026, contracts/api.md)
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { decryptField, encryptField } from '../security/fieldCrypto.js';
import { ApiError, parseId, parseOrThrow, type ApiDeps } from '../http/apiCommon.js';
import {
  buildWaMeUrl,
  canOpenReminderLink,
  renderReminder,
  type ReminderTone,
} from '../domain/reminder.js';
import { generateReminderWithAI } from '../domain/aiAssistant.js';
import { daysBetween } from '../domain/chaseToday.js';
import { uuidSchema } from '../validation/index.js';
import { normalisePhone } from '../validation/phone.js';
import { writeAuditEvent } from '../audit/auditWriter.js';

const reminderCreateSchema = z
  .object({
    invoice_id: uuidSchema,
    tone: z.enum(['friendly', 'neutral', 'firm', 'urgent']).default('friendly'),
    use_ai: z.boolean().default(true),
    custom_note: z.string().max(200).optional(),
    payment_details: z.string().max(100).optional(),
  })
  .strict();

const openLinkSchema = z
  .object({
    owner_confirmed: z.boolean(),
  })
  .strict();

export async function reminderRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  // POST /reminders (Draft reminder)
  app.post('/reminders', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(reminderCreateSchema, request.body);
    const today = new Date().toISOString().slice(0, 10);

    // Fetch invoice + family
    interface InvDetail {
      invoice_id: string;
      family_id: string;
      amount_minor: string | number;
      due_date: string;
      status: string;
      name_ct: Buffer;
      phone_ct: Buffer;
      currency_code: string;
    }

    const rows = await query<InvDetail>(
      `SELECT i.id AS invoice_id, i.family_id, i.amount_minor,
              to_char(i.due_date, 'YYYY-MM-DD') AS due_date, i.status,
              f.name_ct, f.phone_ct, l.currency_code
         FROM invoice i
         JOIN family f ON i.family_id = f.id
         JOIN ledger l ON i.ledger_id = l.id
        WHERE i.id = $1 AND i.ledger_id = $2`,
      [body.invoice_id, ledgerId],
    );

    const inv = rows[0];
    if (!inv) throw new ApiError(404, 'NOT_FOUND');
    if (inv.status === 'paid' || inv.status === 'void') {
      throw new ApiError(409, 'CONFLICT');
    }

    // Get paid balance
    const payRows = await query<{ sum: string | number | null }>(
      'SELECT COALESCE(SUM(amount_minor), 0) AS sum FROM payment WHERE invoice_id = $1 AND ledger_id = $2',
      [body.invoice_id, ledgerId],
    );
    const remainingMinor = Number(inv.amount_minor) - Number(payRows[0]?.sum ?? 0);
    if (remainingMinor <= 0) {
      throw new ApiError(409, 'CONFLICT');
    }

    const familyName = decryptField(deps.fieldKey, inv.name_ct, inv.family_id, 'name_ct');
    const phone = decryptField(deps.fieldKey, inv.phone_ct, inv.family_id, 'phone_ct');
    const daysOverdue = Math.max(0, daysBetween(inv.due_date, today));

    const symbol = inv.currency_code === 'INR' ? '₹' : inv.currency_code === 'GBP' ? '£' : '$';
    const amountStr = `${symbol}${(remainingMinor / 100).toLocaleString('en-IN')}`;

    let reminderText: string;

    if (body.use_ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      const aiGen = await generateReminderWithAI(
        {
          familyName,
          amountFormatted: amountStr,
          dueDate: inv.due_date,
          daysOverdue,
          tone: body.tone,
          paymentDetails: body.payment_details,
          customNote: body.custom_note,
        },
        apiKey,
      );
      reminderText = aiGen.reminderText;
    } else {
      const standardTone = body.tone === 'urgent' ? 'firm' : body.tone;
      reminderText =
        renderReminder(standardTone, {
          family_name: familyName,
          amount: amountStr,
          due_date: inv.due_date,
          days_overdue: String(daysOverdue),
        }) ?? `Reminder: ${amountStr} was due on ${inv.due_date}.`;
    }

    const draftId = randomUUID();
    const textCt = encryptField(deps.fieldKey, reminderText, draftId, 'text_ct');

    await query(
      `INSERT INTO reminder_draft (id, ledger_id, family_id, invoice_id, tone, text_ct, drafted_at, out_of_date)
       VALUES ($1, $2, $3, $4, $5, $6, now(), FALSE)`,
      [draftId, ledgerId, inv.family_id, inv.invoice_id, body.tone === 'urgent' ? 'firm' : body.tone, textCt],
    );

    return reply.code(201).send({
      draft: {
        id: draftId,
        invoice_id: inv.invoice_id,
        family_name: familyName,
        phone_masked: `+•••••${phone.slice(-4)}`,
        phone_full: phone,
        amount_formatted: amountStr,
        tone: body.tone,
        text: reminderText,
        out_of_date: false,
      },
    });
  });

  // GET /reminders/:id
  app.get('/reminders/:id', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const id = parseId((request.params as { id?: unknown }).id);

    interface DraftRow {
      id: string;
      invoice_id: string;
      family_id: string;
      tone: string;
      text_ct: Buffer;
      out_of_date: boolean;
      status: string;
    }

    const rows = await query<DraftRow>(
      `SELECT d.id, d.invoice_id, d.family_id, d.tone, d.text_ct, d.out_of_date, i.status
         FROM reminder_draft d
         JOIN invoice i ON d.invoice_id = i.id
        WHERE d.id = $1 AND d.ledger_id = $2`,
      [id, ledgerId],
    );

    const draft = rows[0];
    if (!draft) throw new ApiError(404, 'NOT_FOUND');

    const text = decryptField(deps.fieldKey, draft.text_ct, draft.id, 'text_ct');
    const isPaid = draft.status === 'paid';

    return reply.send({
      id: draft.id,
      invoice_id: draft.invoice_id,
      tone: draft.tone,
      text,
      out_of_date: draft.out_of_date || isPaid,
      invoice_status: draft.status,
    });
  });

  // POST /reminders/:id/open-link
  // Validates phone, checks invoice is NOT paid, records confirmation, returns wa.me URL
  app.post('/reminders/:id/open-link', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const id = parseId((request.params as { id?: unknown }).id);
    const body = parseOrThrow(openLinkSchema, request.body);

    interface DraftWithPhone {
      id: string;
      invoice_id: string;
      family_id: string;
      text_ct: Buffer;
      out_of_date: boolean;
      status: string;
      phone_ct: Buffer;
    }

    const rows = await query<DraftWithPhone>(
      `SELECT d.id, d.invoice_id, d.family_id, d.text_ct, d.out_of_date, i.status, f.phone_ct
         FROM reminder_draft d
         JOIN invoice i ON d.invoice_id = i.id
         JOIN family f ON d.family_id = f.id
        WHERE d.id = $1 AND d.ledger_id = $2`,
      [id, ledgerId],
    );

    const draft = rows[0];
    if (!draft) throw new ApiError(404, 'NOT_FOUND');

    // Rule: if invoice is paid, refuse with CONFLICT (FR-026)
    const check = canOpenReminderLink({
      ownerConfirmed: body.owner_confirmed,
      outOfDate: draft.out_of_date,
      invoiceStatus: draft.status,
    });

    if (!check.ok) {
      throw new ApiError(409, 'CONFLICT');
    }

    const rawPhone = decryptField(deps.fieldKey, draft.phone_ct, draft.family_id, 'phone_ct');
    const e164 = normalisePhone(rawPhone);
    if (!e164) {
      throw new ApiError(400, 'VALIDATION_FAILED', [{ path: 'phone', rule: 'invalid_e164' }]);
    }

    const text = decryptField(deps.fieldKey, draft.text_ct, draft.id, 'text_ct');
    const waUrl = buildWaMeUrl(e164, text);

    // Record owner send confirmation timestamp
    await query(
      'UPDATE reminder_draft SET send_confirmed_at = now() WHERE id = $1 AND ledger_id = $2',
      [id, ledgerId],
    );

    await writeAuditEvent(
      {
        ledgerId,
        actor: 'owner',
        actionCode: 'REMINDER_LINK_OPENED',
        subjectType: 'family',
        subjectId: draft.family_id,
      },
      deps.auditHmacKey,
    );

    return reply.send({
      url: waUrl,
      status: 'ready_to_send_on_whatsapp',
    });
  });
}
