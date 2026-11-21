// Pure 13-week cash forecast engine. No I/O, deterministic, integer arithmetic only (FR-031..FR-035).

export interface ForecastInvoice {
  id: string;
  familyId: string;
  familyName?: string;
  amountMinor: number;
  remainingMinor: number;
  dueDate: string; // YYYY-MM-DD
  status: 'open' | 'partially-paid';
  familyPaymentCount: number;
  familyAvgDelayDays: number | null; // NULL if no history
}

export interface ForecastBill {
  id: string;
  name: string;
  amountMinor: number;
  frequency: 'monthly';
  nextDueDate: string; // YYYY-MM-DD
  isActive: boolean;
}

export interface ForecastExpense {
  id: string;
  description: string;
  amountMinor: number;
  expenseDate: string; // YYYY-MM-DD
}

export interface ForecastFlowSource {
  sourceType: 'invoice' | 'bill' | 'expense' | 'scenario_inflow' | 'scenario_outflow';
  sourceId: string;
  description: string;
  amountMinor: number;
  date: string;
  familyId?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface ForecastPoint {
  weekIndex: number; // 1 to 13
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  openingBalanceMinor: number;
  inflowsMinor: number;
  outflowsMinor: number;
  closingBalanceMinor: number;
  bestClosingMinor: number;
  worstClosingMinor: number;
  inflowSources: ForecastFlowSource[];
  outflowSources: ForecastFlowSource[];
  confidence: 'high' | 'medium' | 'low';
  belowMinimum: boolean;
}

export interface ForecastInput {
  startDate: string; // YYYY-MM-DD (start of week 1)
  openingBalanceMinor: number;
  minimumBalanceMinor: number;
  invoices: ForecastInvoice[];
  bills: ForecastBill[];
  expenses: ForecastExpense[];
}

export interface ForecastResult {
  weeks: ForecastPoint[];
  lowestCashWeekIndex: number;
  lowestCashMinor: number;
  fallsBelowMinimum: boolean;
  minBalanceThreshold: number;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function getWeekIndex(startDate: string, targetDate: string): number {
  const diff = daysBetween(startDate, targetDate);
  if (diff < 0) return 1; // Past due gets placed in week 1
  return Math.floor(diff / 7) + 1;
}

export function build13WeekForecast(input: ForecastInput): ForecastResult {
  const weeks: ForecastPoint[] = [];
  const start = input.startDate;

  // Initialize 13 weeks
  for (let w = 1; w <= 13; w++) {
    const wStart = addDays(start, (w - 1) * 7);
    const wEnd = addDays(wStart, 6);
    weeks.push({
      weekIndex: w,
      weekStart: wStart,
      weekEnd: wEnd,
      openingBalanceMinor: 0,
      inflowsMinor: 0,
      outflowsMinor: 0,
      closingBalanceMinor: 0,
      bestClosingMinor: 0,
      worstClosingMinor: 0,
      inflowSources: [],
      outflowSources: [],
      confidence: 'high',
      belowMinimum: false,
    });
  }

  // Map Invoices to weeks
  for (const inv of input.invoices) {
    if (inv.remainingMinor <= 0) continue;
    // Delay: if avg delay known, add it; if not known, 0 delay (FR-032, FR-035)
    const delay = inv.familyAvgDelayDays !== null ? Math.round(inv.familyAvgDelayDays) : 0;
    const expectedDate = addDays(inv.dueDate, delay);
    const targetWeek = Math.min(13, Math.max(1, getWeekIndex(start, expectedDate)));

    const isThin = inv.familyPaymentCount < 3;
    const hasNoHistory = inv.familyAvgDelayDays === null;
    const confidence = hasNoHistory ? 'low' : isThin ? 'low' : 'high';

    const week = weeks[targetWeek - 1];
    if (week) {
      week.inflowsMinor += inv.remainingMinor;
      week.inflowSources.push({
        sourceType: 'invoice',
        sourceId: inv.id,
        description: `Invoice for ${inv.familyName ?? 'Family'}`,
        amountMinor: inv.remainingMinor,
        date: expectedDate,
        familyId: inv.familyId,
        confidence,
      });
      if (confidence === 'low') {
        week.confidence = 'low';
      }
    }
  }

  // Map Recurring Bills (monthly) across the 13-week horizon
  for (const bill of input.bills) {
    if (!bill.isActive || bill.amountMinor <= 0) continue;
    let billDate = bill.nextDueDate;
    // Repeat for up to 4 monthly occurrences
    for (let m = 0; m < 4; m++) {
      const wIdx = getWeekIndex(start, billDate);
      if (wIdx >= 1 && wIdx <= 13) {
        const week = weeks[wIdx - 1];
        if (week) {
          week.outflowsMinor += bill.amountMinor;
          week.outflowSources.push({
            sourceType: 'bill',
            sourceId: bill.id,
            description: bill.name,
            amountMinor: bill.amountMinor,
            date: billDate,
          });
        }
      }
      // Next monthly occurrence (+30 days approximately or month advance)
      billDate = addDays(billDate, 30);
    }
  }

  // Map One-off Expenses
  for (const exp of input.expenses) {
    if (exp.amountMinor <= 0) continue;
    const wIdx = getWeekIndex(start, exp.expenseDate);
    if (wIdx >= 1 && wIdx <= 13) {
      const week = weeks[wIdx - 1];
      if (week) {
        week.outflowsMinor += exp.amountMinor;
        week.outflowSources.push({
          sourceType: 'expense',
          sourceId: exp.id,
          description: exp.description,
          amountMinor: exp.amountMinor,
          date: exp.expenseDate,
        });
      }
    }
  }

  // Compute Running Balances & Best/Worst Bands
  let runningBalance = input.openingBalanceMinor;
  let runningBest = input.openingBalanceMinor;
  let runningWorst = input.openingBalanceMinor;

  let lowestCash = runningBalance;
  let lowestCashWeek = 1;
  let fallsBelowMin = false;

  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]!;
    w.openingBalanceMinor = runningBalance;
    runningBalance = runningBalance + w.inflowsMinor - w.outflowsMinor;
    w.closingBalanceMinor = runningBalance;

    // Best case: 10% earlier inflows / all paid
    const bestInflow = Math.round(w.inflowsMinor * 1.05);
    runningBest = runningBest + bestInflow - w.outflowsMinor;
    w.bestClosingMinor = runningBest;

    // Worst case: 20% delay / unpaid risk on thin history
    const worstInflow = w.confidence === 'low' ? Math.round(w.inflowsMinor * 0.7) : Math.round(w.inflowsMinor * 0.9);
    runningWorst = runningWorst + worstInflow - w.outflowsMinor;
    w.worstClosingMinor = runningWorst;

    if (w.closingBalanceMinor < input.minimumBalanceMinor) {
      w.belowMinimum = true;
      fallsBelowMin = true;
    }

    if (w.closingBalanceMinor < lowestCash) {
      lowestCash = w.closingBalanceMinor;
      lowestCashWeek = w.weekIndex;
    }
  }

  return {
    weeks,
    lowestCashWeekIndex: lowestCashWeek,
    lowestCashMinor: lowestCash,
    fallsBelowMinimum: fallsBelowMin,
    minBalanceThreshold: input.minimumBalanceMinor,
  };
}
