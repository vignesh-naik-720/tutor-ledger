import { describe, expect, it } from 'vitest';
import { buildWaMeUrl, canOpenReminderLink } from '../../src/domain/reminder.js';

// S-5: a reminder is never sent automatically; a wa.me link needs explicit owner confirmation (FR-025).
describe('S-5 reminder never auto-sent', () => {
  it('produces no link without owner confirmation', () => {
    const r = canOpenReminderLink({ ownerConfirmed: false, outOfDate: false, invoiceStatus: 'open' });
    expect(r).toEqual({ ok: false, reason: 'OWNER_NOT_CONFIRMED' });
  });

  it('refuses the link when the invoice is already paid (FR-026)', () => {
    const r = canOpenReminderLink({ ownerConfirmed: true, outOfDate: false, invoiceStatus: 'paid' });
    expect(r).toEqual({ ok: false, reason: 'INVOICE_PAID' });
  });

  it('allows the link only after confirmation on an unpaid invoice', () => {
    const r = canOpenReminderLink({ ownerConfirmed: true, outOfDate: false, invoiceStatus: 'open' });
    expect(r).toEqual({ ok: true });
  });

  it('builds a wa.me URL with digits only and an encoded text', () => {
    expect(buildWaMeUrl('+6591234567', 'Hi & bye')).toBe('https://wa.me/6591234567?text=Hi%20%26%20bye');
  });
});
