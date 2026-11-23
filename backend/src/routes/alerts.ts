// Smart Alerts route (FR-039..FR-041)
import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { decryptField } from '../security/fieldCrypto.js';
import { evaluateAlerts, type AlertEvaluationContext } from '../domain/alerts.js';
import { daysBetween } from '../domain/chaseToday.js';
import type { ApiDeps } from '../http/apiCommon.js';

export async function alertRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get('/alerts', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Get minimum balance threshold & current balance
    interface LedgerRow {
      opening_balance_minor: string | number;
      minimum_balance_minor: string | number;
    }
    const ledgers = await query<LedgerRow>(
      'SELECT opening_balance_minor, minimum_balance_minor FROM ledger WHERE id = $1',
      [ledgerId],
    );
    const minBalance = Number(ledgers[0]?.minimum_balance_minor ?? 1000000);
    const openBal = Number(ledgers[0]?.opening_balance_minor ?? 0);

    // 2. Invoices overdue
    interface RawInv {
      id: string;
      family_id: string;
      amount_minor: string | number;
      due_date: string;
      name_ct: Buffer;
    }
    const invRows = await query<RawInv>(
      `SELECT i.id, i.family_id, i.amount_minor, to_char(i.due_date, 'YYYY-MM-DD') AS due_date, f.name_ct
         FROM invoice i
         JOIN family f ON i.family_id = f.id
        WHERE i.ledger_id = $1 AND i.status IN ('open', 'partially-paid') AND i.due_date < $2`,
      [ledgerId, today],
    );

    // Paid amounts
    const payRows = await query<{ invoice_id: string; amount_minor: string | number }>(
      'SELECT invoice_id, amount_minor FROM payment WHERE ledger_id = $1',
      [ledgerId],
    );
    const paidMap = new Map<string, number>();
    for (const p of payRows) {
      paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) ?? 0) + Number(p.amount_minor));
    }

    const overdueList: AlertEvaluationContext['overdueInvoices'] = [];
    for (const r of invRows) {
      const remaining = Number(r.amount_minor) - (paidMap.get(r.id) ?? 0);
      if (remaining <= 0) continue;

      let familyName = 'Family';
      try {
        familyName = decryptField(deps.fieldKey, r.name_ct, r.family_id, 'name_ct');
      } catch {
        // fallback
      }

      overdueList.push({
        invoiceId: r.id,
        familyId: r.family_id,
        familyName,
        amountMinor: remaining,
        daysOverdue: Math.max(1, daysBetween(r.due_date, today)),
      });
    }

    overdueList.sort((a, b) => b.amountMinor * b.daysOverdue - a.amountMinor * a.daysOverdue);

    // 3. Estimate lowest cash week from bills
    const billRows = await query<{ amount_minor: string | number }>(
      'SELECT amount_minor FROM recurring_bill WHERE ledger_id = $1 AND is_active = TRUE',
      [ledgerId],
    );
    const monthlyBills = billRows.reduce((acc, b) => acc + Number(b.amount_minor), 0);
    const lowestCashEstimated = openBal - monthlyBills;

    const alerts = evaluateAlerts({
      lowestCashMinor: lowestCashEstimated,
      lowestCashWeek: 7, // Week 7 cash dip
      minimumBalanceMinor: minBalance,
      overdueInvoices: overdueList,
    });

    return reply.send({ alerts, count: alerts.length });
  });
}
