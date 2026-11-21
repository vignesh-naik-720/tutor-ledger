// Reminder drafts (T047, domain part). Templates are server-side; placeholder values are inserted
// as plain text and never interpreted as markup. Nothing is sent automatically (FR-025).

export const REMINDER_TONES = ['friendly', 'neutral', 'firm'] as const;
export type ReminderTone = (typeof REMINDER_TONES)[number];

export const REMINDER_MAX_CHARS = 500;

const TEMPLATES: Readonly<Record<ReminderTone, string>> = {
  friendly: 'Hi {family_name}, a friendly reminder that {amount} was due on {due_date}. Thank you!',
  neutral: 'Hello {family_name}, {amount} was due on {due_date} and is {days_overdue} days overdue.',
  firm: 'Dear {family_name}, {amount} was due on {due_date} and remains unpaid after {days_overdue} days.',
};

export interface ReminderValues {
  family_name: string;
  amount: string;
  due_date: string;
  days_overdue: string;
}

export function renderReminder(tone: ReminderTone, values: ReminderValues): string | null {
  const template = TEMPLATES[tone];
  const text = template.replace(/\{(family_name|amount|due_date|days_overdue)\}/g, (_m, key: keyof ReminderValues) =>
    values[key],
  );
  return text.length <= REMINDER_MAX_CHARS ? text : null;
}

/** The wa.me link is produced only with explicit owner confirmation and an unpaid invoice (FR-025, FR-026). */
export function canOpenReminderLink(input: {
  ownerConfirmed: boolean;
  outOfDate: boolean;
  invoiceStatus: string;
}): { ok: true } | { ok: false; reason: 'OWNER_NOT_CONFIRMED' | 'INVOICE_PAID' | 'OUT_OF_DATE' } {
  if (!input.ownerConfirmed) return { ok: false, reason: 'OWNER_NOT_CONFIRMED' };
  if (input.invoiceStatus === 'paid') return { ok: false, reason: 'INVOICE_PAID' };
  if (input.outOfDate) return { ok: false, reason: 'OUT_OF_DATE' };
  return { ok: true };
}

/** Builds the wa.me URL from normalised digits and an encoded text (contracts/api.md). */
export function buildWaMeUrl(e164: string, text: string): string {
  const digits = e164.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
