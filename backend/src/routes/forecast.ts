// 13-Week Cash Forecast routes (FR-031..FR-035)
import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { decryptField } from '../security/fieldCrypto.js';
import { loadLedger, type ApiDeps } from '../http/apiCommon.js';
import { build13WeekForecast, type ForecastInvoice, type ForecastBill, type ForecastExpense } from '../../../shared/forecast/src/forecast.js';
import { applyScenarios, type ScenarioDefinition } from '../../../shared/forecast/src/scenarios.js';

export async function forecastRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get('/forecast', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const ledger = await loadLedger(ledgerId);
    const today = new Date().toISOString().slice(0, 10);

    // 1. Load ledger opening & minimum balance
    interface LedgerBal {
      opening_balance_minor: string | number;
      minimum_balance_minor: string | number;
    }
    const bals = await query<LedgerBal>(
      'SELECT opening_balance_minor, minimum_balance_minor FROM ledger WHERE id = $1',
      [ledgerId],
    );
    const openingBalance = Number(bals[0]?.opening_balance_minor ?? 0);
    const minBalance = Number(bals[0]?.minimum_balance_minor ?? 1000000);

    // 2. Load open & partially-paid invoices
    interface RawInv {
      id: string;
      family_id: string;
      amount_minor: string | number;
      due_date: string;
      status: string;
      name_ct: Buffer;
      payment_count: number;
      avg_delay_days: string | null;
    }

    const invRows = await query<RawInv>(
      `SELECT i.id, i.family_id, i.amount_minor,
              to_char(i.due_date, 'YYYY-MM-DD') AS due_date, i.status,
              f.name_ct, f.payment_count, f.avg_delay_days
         FROM invoice i
         JOIN family f ON i.family_id = f.id
        WHERE i.ledger_id = $1 AND i.status IN ('open', 'partially-paid')`,
      [ledgerId],
    );

    // Payments for invoices
    const payRows = await query<{ invoice_id: string; amount_minor: string | number }>(
      'SELECT invoice_id, amount_minor FROM payment WHERE ledger_id = $1',
      [ledgerId],
    );
    const paidMap = new Map<string, number>();
    for (const p of payRows) {
      paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) ?? 0) + Number(p.amount_minor));
    }

    const forecastInvoices: ForecastInvoice[] = [];
    for (const r of invRows) {
      const paid = paidMap.get(r.id) ?? 0;
      const remaining = Number(r.amount_minor) - paid;
      if (remaining <= 0) continue;

      let familyName = 'Family';
      try {
        familyName = decryptField(deps.fieldKey, r.name_ct, r.family_id, 'name_ct');
      } catch {
        // fallback
      }

      forecastInvoices.push({
        id: r.id,
        familyId: r.family_id,
        familyName,
        amountMinor: Number(r.amount_minor),
        remainingMinor: remaining,
        dueDate: r.due_date,
        status: r.status as any,
        familyPaymentCount: r.payment_count,
        familyAvgDelayDays: r.avg_delay_days === null ? null : Number(r.avg_delay_days),
      });
    }

    // 3. Load Recurring Bills
    interface RawBill {
      id: string;
      name: string;
      amount_minor: string | number;
      frequency: string;
      next_due_date: string;
      is_active: boolean;
    }
    const billRows = await query<RawBill>(
      `SELECT id, name, amount_minor, frequency, to_char(next_due_date, 'YYYY-MM-DD') AS next_due_date, is_active
         FROM recurring_bill
        WHERE ledger_id = $1 AND is_active = TRUE`,
      [ledgerId],
    );
    const forecastBills: ForecastBill[] = billRows.map((b) => ({
      id: b.id,
      name: b.name,
      amountMinor: Number(b.amount_minor),
      frequency: 'monthly',
      nextDueDate: b.next_due_date,
      isActive: Boolean(b.is_active),
    }));

    // 4. Load One-off Expenses
    interface RawExp {
      id: string;
      description: string;
      amount_minor: string | number;
      expense_date: string;
    }
    const expRows = await query<RawExp>(
      `SELECT id, description, amount_minor, to_char(expense_date, 'YYYY-MM-DD') AS expense_date
         FROM one_off_expense
        WHERE ledger_id = $1`,
      [ledgerId],
    );
    const forecastExpenses: ForecastExpense[] = expRows.map((e) => ({
      id: e.id,
      description: e.description,
      amountMinor: Number(e.amount_minor),
      expenseDate: e.expense_date,
    }));

    // 5. Load Active Scenarios
    interface RawScen {
      id: string;
      name: string;
      type: string;
      parameters: any;
      is_on: boolean;
    }
    const scenRows = await query<RawScen>(
      'SELECT id, name, type, parameters, is_on FROM scenario WHERE ledger_id = $1 AND is_on = TRUE',
      [ledgerId],
    );

    const activeScenarios: ScenarioDefinition[] = scenRows.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type as any,
      isOn: Boolean(s.is_on),
      parameters: typeof s.parameters === 'string' ? JSON.parse(s.parameters) : s.parameters,
    }));

    // Baseline forecast
    const baseInput = {
      startDate: today,
      openingBalanceMinor: openingBalance,
      minimumBalanceMinor: minBalance,
      invoices: forecastInvoices,
      bills: forecastBills,
      expenses: forecastExpenses,
    };

    const baselineResult = build13WeekForecast(baseInput);

    // Scenario transformed forecast (if any active)
    let scenarioResult = null;
    if (activeScenarios.length > 0) {
      const scenarioInput = applyScenarios(baseInput, activeScenarios);
      scenarioResult = build13WeekForecast(scenarioInput);
    }

    return reply.send({
      currency_code: ledger.currency_code ?? 'INR',
      baseline: baselineResult,
      scenario: scenarioResult,
      active_scenarios_count: activeScenarios.length,
    });
  });
}
