import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_CHARS, parsePaymentMessage } from '../../src/domain/messageParser.js';
import { checkPayment } from '../../src/domain/payment.js';

// S-4: pasted-message parsing only pre-fills; it flags ambiguous amounts and never records (FR-023, FR-024).
describe('S-4 pasted-message pre-fill', () => {
  it('pre-fills a single unambiguous amount and date without flagging', () => {
    const r = parsePaymentMessage('Paid 200.00 on 2026-11-20 for Term 2', 2);
    expect(r).toEqual({
      ok: true,
      draft: { amount_minor: 20000, date: '2026-11-20', amount_flagged: false, candidates: 1 },
    });
  });

  it('flags the amount when several amounts appear', () => {
    const r = parsePaymentMessage('Paid 200 of 350 today', 2);
    expect(r.ok && r.draft.amount_flagged).toBe(true);
    expect(r.ok && r.draft.amount_minor).toBeNull();
  });

  it('rejects input over 2,000 characters', () => {
    const r = parsePaymentMessage('a'.repeat(MAX_MESSAGE_CHARS + 1));
    expect(r).toEqual({ ok: false, reason: 'TOO_LONG' });
  });

  it('refuses to confirm a flagged pasted amount', () => {
    const err = checkPayment({
      amountMinor: 20000,
      remainingMinor: 50000,
      invoiceStatus: 'open',
      source: 'confirmed_pasted_message',
      amountFlagged: true,
    });
    expect(err).toBe('FLAGGED_AMOUNT');
  });

  it('refuses overpayment', () => {
    const err = checkPayment({
      amountMinor: 60000,
      remainingMinor: 50000,
      invoiceStatus: 'open',
      source: 'owner_entry',
      amountFlagged: false,
    });
    expect(err).toBe('OVERPAYMENT');
  });
});
