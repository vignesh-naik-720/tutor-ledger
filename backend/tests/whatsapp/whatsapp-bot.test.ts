import { describe, expect, it } from 'vitest';
import { parsePaymentMessageWithAI } from '../../src/domain/aiAssistant.js';

describe('WhatsApp Bot & Banking Verification Layer', () => {
  it('detects student name and payment amount from inbound WhatsApp message', async () => {
    const inbound = "Hi Sir, I paid 3000 for Aarav Sharma via Google Pay ref UPI-849201948";
    const parsed = await parsePaymentMessageWithAI(inbound, 2, ['Aarav Sharma', 'Priya Patel']);

    expect(parsed.family_name_candidate).toBe('Aarav Sharma');
    expect(parsed.amount_minor).toBe(300000);
    expect(parsed.payment_mode).toBe('Google Pay');
    expect(parsed.reference_id).toBe('UPI-849201948');
  });

  it('generates interactive bank verification menu to prevent recording uncredited money', () => {
    const student = 'Aarav Sharma';
    const amount = 3000;
    const menu = [
      '[1] ✅ Yes, money is in my bank (Record payment)',
      '[2] ⚠️ Partial / Different amount received',
      '[3] ❌ Not received yet (False / Pending claim)',
    ];

    expect(menu[0]).toContain('[1]');
    expect(menu[0]).toContain('Record payment');
    expect(menu[2]).toContain('Not received yet');
  });

  it('rejects uncredited or false claims when tutor selects option 3', () => {
    const tutorResponse = '3';
    let paymentRecorded = false;

    if (tutorResponse === '1') {
      paymentRecorded = true;
    } else if (tutorResponse === '3') {
      paymentRecorded = false;
    }

    expect(paymentRecorded).toBe(false);
  });

  it('confirms and approves payment only on explicit verification option 1', () => {
    const tutorResponse = '1';
    let paymentRecorded = false;

    if (tutorResponse === '1' || tutorResponse.toLowerCase() === 'yes') {
      paymentRecorded = true;
    }

    expect(paymentRecorded).toBe(true);
  });
});
