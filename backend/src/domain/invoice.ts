// Invoice domain rules (T040). Pure functions: no I/O.

export const INVOICE_STATUSES = [
  'draft',
  'due-awaiting-confirmation',
  'open',
  'partially-paid',
  'paid',
  'void',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface InvoiceFields {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  amountMinor: number;
  issueDate: string;
  dueDate: string;
}

export type InvoiceRuleError =
  | 'PERIOD_ORDER'
  | 'AMOUNT_NOT_POSITIVE'
  | 'DUE_BEFORE_ISSUE';

/** Returns the first rule violated, or null when the invoice fields are valid. */
export function validateInvoiceFields(f: InvoiceFields): InvoiceRuleError | null {
  if (f.periodEnd < f.periodStart) return 'PERIOD_ORDER';
  if (!Number.isInteger(f.amountMinor) || f.amountMinor <= 0) return 'AMOUNT_NOT_POSITIVE';
  if (f.dueDate < f.issueDate) return 'DUE_BEFORE_ISSUE';
  return null;
}

const TRANSITIONS: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
  draft: ['open', 'void'],
  'due-awaiting-confirmation': ['open', 'void'],
  open: ['partially-paid', 'paid', 'void'],
  'partially-paid': ['partially-paid', 'paid', 'void'],
  paid: [],
  void: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Derived values (data-model.md Invoice): never stored. */
export function remainingMinor(amountMinor: number, paidMinor: number): number {
  return amountMinor - paidMinor;
}

/** Void is blocked once any payment exists (keeps money history intact). */
export function canVoid(status: InvoiceStatus, paymentCount: number): boolean {
  if (paymentCount > 0) return false;
  return status === 'draft' || status === 'due-awaiting-confirmation' || status === 'open';
}

/** Optimistic concurrency for non-money edits (FR-027, R-1). */
export function versionMatches(storedVersion: number, expectedVersion: number): boolean {
  return storedVersion === expectedVersion;
}
