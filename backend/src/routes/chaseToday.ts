// Chase Today route: priority-ranked overdue invoices (FR-019)
import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { decryptField } from '../security/fieldCrypto.js';
import { rankChaseToday, type ChaseCandidate } from '../domain/chaseToday.js';
import type { ApiDeps } from '../http/apiCommon.js';

export async function chaseTodayRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get('/chase-today', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Load open and partially-paid invoices
    interface RawInvoice {
      id: string;
      family_id: string;
      amount_minor: string | number;
      due_date: string;
      status: string;
      name_ct: Buffer;
      phone_ct: Buffer;
      payment_count: number;
      avg_delay_days: string | null;
      default_tone: string;
    }

    const rows = await query<RawInvoice>(
      `SELECT i.id, i.family_id, i.amount_minor,
              to_char(i.due_date, 'YYYY-MM-DD') AS due_date, i.status,
              f.name_ct, f.phone_ct, f.payment_count, f.avg_delay_days, f.default_tone
         FROM invoice i
         JOIN family f ON i.family_id = f.id
        WHERE i.ledger_id = $1 AND i.status IN ('open', 'partially-paid')`,
      [ledgerId],
    );

    // 2. Load payments to compute remaining balances
    interface PayRow {
      invoice_id: string;
      amount_minor: string | number;
    }
    const payRows = await query<PayRow>(
      'SELECT invoice_id, amount_minor FROM payment WHERE ledger_id = $1',
      [ledgerId],
    );
    const paidByInv = new Map<string, number>();
    for (const p of payRows) {
      paidByInv.set(p.invoice_id, (paidByInv.get(p.invoice_id) ?? 0) + Number(p.amount_minor));
    }

    // 3. Build candidates for ranking
    const familyMap = new Map<string, { name: string; phone: string; tone: string }>();
    const candidates: ChaseCandidate[] = [];

    for (const r of rows) {
      const paid = paidByInv.get(r.id) ?? 0;
      const remaining = Number(r.amount_minor) - paid;
      if (remaining <= 0) continue;

      let name = 'Family';
      let phone = '';
      try {
        name = decryptField(deps.fieldKey, r.name_ct, r.family_id, 'name_ct');
        phone = decryptField(deps.fieldKey, r.phone_ct, r.family_id, 'phone_ct');
      } catch {
        // use fallback
      }

      familyMap.set(r.id, { name, phone, tone: r.default_tone });

      candidates.push({
        invoiceId: r.id,
        familyId: r.family_id,
        remainingMinor: remaining,
        dueDate: r.due_date,
        status: r.status as any,
        paymentCount: r.payment_count,
        avgDelayDays: r.avg_delay_days === null ? null : Number(r.avg_delay_days),
      });
    }

    // 4. Rank with spec algorithm
    const ranked = rankChaseToday(candidates, today);

    // 5. Enrich with display details
    const items = ranked.map((item) => {
      const meta = familyMap.get(item.invoiceId);
      const e164 = meta?.phone ?? '';
      const masked = e164 ? `+•••••${e164.slice(-4)}` : '';
      return {
        invoice_id: item.invoiceId,
        family_id: item.familyId,
        family_name: meta?.name ?? 'Family',
        phone_masked: masked,
        phone_full: e164,
        remaining_minor: item.remainingMinor,
        due_date: item.dueDate,
        days_overdue: item.daysOverdue,
        priority_score: item.score,
        thin_history: item.thinHistory,
        default_tone: meta?.tone ?? 'friendly',
      };
    });

    return reply.send({
      chase_today: items,
      total_count: items.length,
      total_amount_minor: items.reduce((acc, it) => acc + it.remaining_minor, 0),
    });
  });
}
