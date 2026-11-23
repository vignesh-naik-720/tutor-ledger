import { describe, expect, it } from 'vitest';
import {
  parsePaymentMessageWithAI,
  generateReminderWithAI,
  generateCashFlowInsights,
} from '../../src/domain/aiAssistant.js';

describe('AI Assistant & Copilot for Tutor Ledger', () => {
  it('extracts payment amounts, payment modes, and partial payments from messy WhatsApp text', async () => {
    const rawMessage = 'Namaste Sir, paid 3500 via GPay today for Aryan tuition fee, remaining 1000 will pay next week.';
    const result = await parsePaymentMessageWithAI(rawMessage, 2, ['Aryan Family', 'Sharma Family']);

    expect(result.amount_minor).toBe(350000); // ₹3500.00
    expect(result.payment_mode).toBe('Google Pay');
    expect(result.is_partial).toBe(true);
    expect(result.confidence).toBe('medium');
    expect(result.amount_flagged).toBe(true); // 3500 and 1000 detected
  });

  it('extracts single amount cleanly with zero flags', async () => {
    const raw = 'Sent Rs 4500 via PhonePe txn 982348123';
    const result = await parsePaymentMessageWithAI(raw, 2);

    expect(result.amount_minor).toBe(450000);
    expect(result.payment_mode).toBe('PhonePe');
    expect(result.reference_id).toBe('982348123');
    expect(result.amount_flagged).toBe(false);
  });

  it('generates courteous, relationship-preserving WhatsApp reminders across different tones', async () => {
    const friendly = await generateReminderWithAI({
      familyName: 'Sharma Family',
      studentName: 'Aarav',
      amountFormatted: '₹4,500',
      dueDate: '2026-11-15',
      daysOverdue: 6,
      tone: 'friendly',
    });
    expect(friendly.reminderText).toContain('Aarav');
    expect(friendly.reminderText).toContain('₹4,500');
    expect(friendly.reminderText.length).toBeLessThanOrEqual(500);

    const firm = await generateReminderWithAI({
      familyName: 'Patel Family',
      amountFormatted: '₹6,000',
      dueDate: '2026-11-01',
      daysOverdue: 20,
      tone: 'firm',
    });
    expect(firm.reminderText).toContain('20 days overdue');
    expect(firm.reminderText).toContain('₹6,000');
  });

  it('generates intelligent cash flow copilot insights and actionable tutor advice', () => {
    const insights = generateCashFlowInsights(
      1500000, // ₹15,000 lowest cash
      7, // Week 7
      2000000, // ₹20,000 minimum safety cushion
      3, // 3 overdue invoices
      1400000, // ₹14,000 total overdue
      'INR',
    );

    expect(insights.status).toBe('caution');
    expect(insights.lowestCashWeek).toBe(7);
    expect(insights.actions.length).toBeGreaterThan(0);
    expect(insights.summary).toContain('Week 7');
  });
});
