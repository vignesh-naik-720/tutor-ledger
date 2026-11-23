// Payment domain rules (T043). Pure functions: no I/O. Storage (append-only insert) lives in the
// route layer; the database enforces UNIQUE (ledger_id, client_event_id) and CHECK amount > 0.

export const PAYMENT_SOURCES = ['owner_entry', 'confirmed_pasted_message'] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

export type PaymentRuleError =
  | 'AMOUNT_NOT_POSITIVE'
  | 'OVERPAYMENT'
  | 'INVOICE_NOT_PAYABLE'
  | 'FLAGGED_AMOUNT';

export interface PaymentCheckInput {
  amountMinor: number;
  remainingMinor: number;
  invoiceStatus: 'open' | 'partially-paid' | 'paid' | 'void' | 'draft' | 'due-awaiting-confirmation';
  source: PaymentSource;
  amountFlagged: boolean;
}

/** Validates a payment against the invoice. Returns null when it may be recorded. */
export function checkPayment(input: PaymentCheckInput): PaymentRuleError | null {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return 'AMOUNT_NOT_POSITIVE';
  }
  if (input.invoiceStatus !== 'open' && input.invoiceStatus !== 'partially-paid') {
    return 'INVOICE_NOT_PAYABLE';
  }
  if (input.amountMinor > input.remainingMinor) {
    return 'OVERPAYMENT';
  }
  // FR-024: a flagged pasted amount must be cleared by the owner before it can be confirmed.
  if (input.source === 'confirmed_pasted_message' && input.amountFlagged) {
    return 'FLAGGED_AMOUNT';
  }
  return null;
}

/** Status after a payment is accepted (data-model.md Invoice state transitions). */
export function statusAfterPayment(remainingAfterMinor: number): 'partially-paid' | 'paid' {
  return remainingAfterMinor === 0 ? 'paid' : 'partially-paid';
}
