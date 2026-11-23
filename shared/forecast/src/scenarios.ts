// Pure scenario transforms applied to forecast inputs (FR-036..FR-038).
import {
  type ForecastInput,
  type ForecastInvoice,
  type ForecastBill,
  addDays,
} from './forecast.js';
import { applyBasisPoints } from './money.js';

export type ScenarioType =
  | 'builtin_late_payment'
  | 'builtin_family_leaves'
  | 'builtin_new_family'
  | 'builtin_bill_rise'
  | 'combination'
  | 'custom';

export interface LatePaymentParams {
  familyId: string;
  delayDays: number; // e.g. 15 days late
}

export interface FamilyLeavesParams {
  familyId: string;
  effectiveDate: string; // YYYY-MM-DD
}

export interface NewFamilyParams {
  name: string;
  startDate: string;
  feeMinor: number;
  termDays: number;
}

export interface BillRiseParams {
  billId?: string; // specific bill or all
  percentBp: number; // basis points, e.g. 1500 for 15%
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  type: ScenarioType;
  isOn: boolean;
  parameters: {
    latePayment?: LatePaymentParams;
    familyLeaves?: FamilyLeavesParams;
    newFamily?: NewFamilyParams;
    billRise?: BillRiseParams;
    customInflowChangeMinor?: number;
    customOutflowChangeMinor?: number;
  };
}

export function applyScenarios(
  baseInput: ForecastInput,
  scenarios: readonly ScenarioDefinition[],
): ForecastInput {
  // Deep clone invoices and bills to remain pure
  let invoices: ForecastInvoice[] = baseInput.invoices.map((inv) => ({ ...inv }));
  let bills: ForecastBill[] = baseInput.bills.map((b) => ({ ...b }));
  const expenses = baseInput.expenses.map((e) => ({ ...e }));

  for (const sc of scenarios) {
    if (!sc.isOn) continue;

    // 1. Late Payment (named family pays N days late)
    if (sc.parameters.latePayment) {
      const { familyId, delayDays } = sc.parameters.latePayment;
      invoices = invoices.map((inv) => {
        if (inv.familyId === familyId) {
          return {
            ...inv,
            dueDate: addDays(inv.dueDate, delayDays),
          };
        }
        return inv;
      });
    }

    // 2. Family Leaves at date
    if (sc.parameters.familyLeaves) {
      const { familyId, effectiveDate } = sc.parameters.familyLeaves;
      invoices = invoices.filter((inv) => {
        if (inv.familyId === familyId && inv.dueDate >= effectiveDate) {
          return false;
        }
        return true;
      });
    }

    // 3. New Family joins
    if (sc.parameters.newFamily) {
      const { name, startDate, feeMinor, termDays } = sc.parameters.newFamily;
      // Add simulated upcoming invoices in the horizon
      let nextDue = addDays(startDate, termDays);
      for (let i = 0; i < 3; i++) {
        invoices.push({
          id: `sim-new-fam-${sc.id}-${i}`,
          familyId: `new-fam-${sc.id}`,
          familyName: name,
          amountMinor: feeMinor,
          remainingMinor: feeMinor,
          dueDate: nextDue,
          status: 'open',
          familyPaymentCount: 0,
          familyAvgDelayDays: null,
        });
        nextDue = addDays(nextDue, 30);
      }
    }

    // 4. Bill rises by percentage
    if (sc.parameters.billRise) {
      const { billId, percentBp } = sc.parameters.billRise;
      bills = bills.map((bill) => {
        if (!billId || bill.id === billId) {
          const increase = applyBasisPoints(bill.amountMinor, percentBp);
          return {
            ...bill,
            amountMinor: bill.amountMinor + increase,
          };
        }
        return bill;
      });
    }

    // 5. Custom scenario
    if (sc.type === 'custom') {
      if (sc.parameters.customOutflowChangeMinor) {
        expenses.push({
          id: `custom-exp-${sc.id}`,
          description: sc.name,
          amountMinor: sc.parameters.customOutflowChangeMinor,
          expenseDate: addDays(baseInput.startDate, 14),
        });
      }
    }
  }

  return {
    ...baseInput,
    invoices,
    bills,
    expenses,
  };
}
