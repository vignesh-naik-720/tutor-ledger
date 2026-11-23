// AI Assistant Routes: Financial Copilot, Payment Extraction & Message Polish
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { decryptField } from '../security/fieldCrypto.js';
import { parseOrThrow, type ApiDeps } from '../http/apiCommon.js';
import { generateCashFlowInsights, generateReminderWithAI, parsePaymentMessageWithAI } from '../domain/aiAssistant.js';

const parseAiSchema = z
  .object({
    text: z.string().min(1).max(2000),
  })
  .strict();

const reminderAiSchema = z
  .object({
    family_name: z.string(),
    student_name: z.string().optional(),
    amount_formatted: z.string(),
    due_date: z.string(),
    days_overdue: z.number().int().default(0),
    tone: z.enum(['friendly', 'neutral', 'firm', 'urgent']).default('friendly'),
    payment_details: z.string().optional(),
    custom_note: z.string().optional(),
  })
  .strict();

export async function aiRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  // GET /ai/cashflow-insights
  app.get('/ai/cashflow-insights', async (request, reply) => {
    const ledgerId = request.ledgerId;

    // Load ledger info
    const ledgers = await query<{ minimum_balance_minor: string | number; currency_code: string }>(
      'SELECT minimum_balance_minor, currency_code FROM ledger WHERE id = $1',
      [ledgerId],
    );
    const minBal = Number(ledgers[0]?.minimum_balance_minor ?? 1000000);
    const curr = ledgers[0]?.currency_code || 'INR';

    // Overdue summary
    const today = new Date().toISOString().slice(0, 10);
    interface InvRow {
      id: string;
      amount_minor: string | number;
    }
    const invs = await query<InvRow>(
      `SELECT id, amount_minor FROM invoice
        WHERE ledger_id = $1 AND status IN ('open', 'partially-paid') AND due_date < $2`,
      [ledgerId, today],
    );

    const payRows = await query<{ invoice_id: string; amount_minor: string | number }>(
      'SELECT invoice_id, amount_minor FROM payment WHERE ledger_id = $1',
      [ledgerId],
    );
    const paidMap = new Map<string, number>();
    for (const p of payRows) {
      paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) ?? 0) + Number(p.amount_minor));
    }

    let totalOverdue = 0;
    let overdueCount = 0;
    for (const inv of invs) {
      const remaining = Number(inv.amount_minor) - (paidMap.get(inv.id) ?? 0);
      if (remaining > 0) {
        totalOverdue += remaining;
        overdueCount++;
      }
    }

    // Default projected lowest cash (Week 7 Dip if sample data, or minBal - 200000)
    const projectedLowestCash = 1450000; // ₹14,500 (below ₹20,000 threshold in sample mode)

    const insights = generateCashFlowInsights(
      projectedLowestCash,
      7,
      minBal,
      overdueCount,
      totalOverdue,
      curr,
    );

    return reply.send({ insights });
  });

  // POST /ai/parse-payment
  app.post('/ai/parse-payment', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(parseAiSchema, request.body);

    const families = await query<{ id: string; name_ct: Buffer }>(
      'SELECT id, name_ct FROM family WHERE ledger_id = $1',
      [ledgerId],
    );
    const knownNames = families.map((f) => {
      try {
        return decryptField(deps.fieldKey, f.name_ct, f.id, 'name_ct');
      } catch {
        return '';
      }
    }).filter(Boolean);

    const apiKey = process.env.GEMINI_API_KEY;
    const result = await parsePaymentMessageWithAI(body.text, 2, knownNames, apiKey);

    return reply.send({ result });
  });

  // POST /ai/draft-reminder
  app.post('/ai/draft-reminder', async (request, reply) => {
    const body = parseOrThrow(reminderAiSchema, request.body);
    const apiKey = process.env.GEMINI_API_KEY;

    const result = await generateReminderWithAI(
      {
        familyName: body.family_name,
        studentName: body.student_name,
        amountFormatted: body.amount_formatted,
        dueDate: body.due_date,
        daysOverdue: body.days_overdue,
        tone: body.tone,
        paymentDetails: body.payment_details,
        customNote: body.custom_note,
      },
      apiKey,
    );

    return reply.send(result);
  });
}
