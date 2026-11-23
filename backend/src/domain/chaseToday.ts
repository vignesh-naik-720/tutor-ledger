// Chase Today ranking (T046). Pure function: no I/O.
// FR-019: priority is a score combining amount owed and days overdue; highest score first;
// ties broken by the older due date. Each invoice appears once.
// Score used: remaining_minor * days_overdue (integer arithmetic, no floats).

export interface ChaseCandidate {
  invoiceId: string;
  familyId: string;
  remainingMinor: number;
  dueDate: string; // YYYY-MM-DD
  status: 'open' | 'partially-paid' | 'paid' | 'void' | 'draft' | 'due-awaiting-confirmation';
  paymentCount: number; // Family.payment_count (thin history when < 3)
  avgDelayDays: number | null; // Family.avg_delay_days (NULL when no history)
}

export interface ChaseItem extends ChaseCandidate {
  daysOverdue: number;
  score: number;
  thinHistory: boolean;
}

export const THIN_HISTORY_PAYMENTS = 3;

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function rankChaseToday(candidates: readonly ChaseCandidate[], todayIso: string): ChaseItem[] {
  const seen = new Set<string>();
  const items: ChaseItem[] = [];
  for (const c of candidates) {
    if (seen.has(c.invoiceId)) continue; // each invoice listed once
    seen.add(c.invoiceId);
    if (c.status !== 'open' && c.status !== 'partially-paid') continue;
    if (c.remainingMinor <= 0) continue;
    const daysOverdue = daysBetween(c.dueDate, todayIso);
    if (daysOverdue <= 0) continue;
    items.push({
      ...c,
      daysOverdue,
      score: c.remainingMinor * daysOverdue,
      thinHistory: c.paymentCount < THIN_HISTORY_PAYMENTS,
    });
  }
  items.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (x.dueDate !== y.dueDate) return x.dueDate < y.dueDate ? -1 : 1;
    return x.invoiceId < y.invoiceId ? -1 : x.invoiceId > y.invoiceId ? 1 : 0;
  });
  return items;
}
