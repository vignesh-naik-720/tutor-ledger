import type { InvoiceStatus } from './invoice.js';

// Repeat invoice generation (T041). A repeat is created as due-awaiting-confirmation and is
// skipped when an invoice already exists for (family, period_start) (FR-021, FR-022).

export interface ExistingInvoiceKey {
  familyId: string;
  periodStart: string;
}

export interface RepeatCandidate {
  familyId: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
}

export function planRepeatInvoices(
  families: readonly { familyId: string; feeMinor: number; termDays: number }[],
  period: { periodStart: string; periodEnd: string; issueDate: string },
  existing: readonly ExistingInvoiceKey[],
): { created: RepeatCandidate[]; skipped: string[] } {
  const taken = new Set(existing.map((e) => `${e.familyId}|${e.periodStart}`));
  const created: RepeatCandidate[] = [];
  const skipped: string[] = [];
  for (const family of families) {
    if (taken.has(`${family.familyId}|${period.periodStart}`)) {
      skipped.push(family.familyId);
      continue;
    }
    created.push({
      familyId: family.familyId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      amountMinor: family.feeMinor,
      issueDate: period.issueDate,
      dueDate: addDays(period.issueDate, family.termDays),
      status: 'due-awaiting-confirmation',
    });
  }
  return { created, skipped };
}

/** Adds whole days to a YYYY-MM-DD date using UTC arithmetic (no timezone drift). */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
