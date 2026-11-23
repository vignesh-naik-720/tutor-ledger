// Who Owes Me queries & calculations (FR-028..FR-030).
// Shows families with outstanding balances, oldest unpaid date, total owed,
// ledger-wide totals and average days to pay.

import { query } from '../db/client.js';
import { decryptField } from '../security/fieldCrypto.js';
import { daysBetween } from './chaseToday.js';

export interface FamilyWhoOwes {
  family_id: string;
  family_name: string;
  phone_masked: string;
  outstanding_minor: number;
  oldest_unpaid_date: string;
  total_invoiced_minor: number;
  open_invoices_count: number;
  days_oldest_overdue: number;
  default_tone: 'friendly' | 'neutral' | 'firm';
}

export interface WhoOwesSummary {
  currency_code: string;
  total_outstanding_minor: number;
  families_owing_count: number;
  average_days_to_pay: number;
  families: FamilyWhoOwes[];
  has_more: boolean;
}

export async function getWhoOwes(
  ledgerId: string,
  fieldKey: Buffer,
  currencyCode = 'INR',
  limit = 5,
  showAll = false,
  todayIso: string = new Date().toISOString().slice(0, 10),
): Promise<WhoOwesSummary> {
  // Query all open and partially paid invoices
  interface InvRow {
    id: string;
    family_id: string;
    amount_minor: string | number;
    due_date: string;
    status: string;
  }

  const invoices = await query<InvRow>(
    `SELECT id, family_id, amount_minor, to_char(due_date, 'YYYY-MM-DD') AS due_date, status
       FROM invoice
      WHERE ledger_id = $1 AND status IN ('open', 'partially-paid')
      ORDER BY due_date ASC`,
    [ledgerId],
  );

  // Query all payments on these invoices
  interface PayRow {
    invoice_id: string;
    amount_minor: string | number;
    date_received: string;
  }
  const payments = await query<PayRow>(
    `SELECT invoice_id, amount_minor, to_char(date_received, 'YYYY-MM-DD') AS date_received
       FROM payment
      WHERE ledger_id = $1`,
    [ledgerId],
  );

  const paidByInvoice = new Map<string, number>();
  for (const p of payments) {
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount_minor));
  }

  // Aggregate by family
  const familyBalances = new Map<
    string,
    {
      outstanding: number;
      totalInvoiced: number;
      oldestDue: string;
      invoiceCount: number;
    }
  >();

  for (const inv of invoices) {
    const total = Number(inv.amount_minor);
    const paid = paidByInvoice.get(inv.id) ?? 0;
    const remaining = total - paid;
    if (remaining <= 0) continue;

    const existing = familyBalances.get(inv.family_id) ?? {
      outstanding: 0,
      totalInvoiced: 0,
      oldestDue: inv.due_date,
      invoiceCount: 0,
    };

    existing.outstanding += remaining;
    existing.totalInvoiced += total;
    existing.invoiceCount += 1;
    if (inv.due_date < existing.oldestDue) {
      existing.oldestDue = inv.due_date;
    }
    familyBalances.set(inv.family_id, existing);
  }

  // Load family details
  interface FamilyRow {
    id: string;
    name_ct: Buffer;
    phone_ct: Buffer;
    default_tone: string;
    avg_delay_days: string | null;
  }

  const famRows = await query<FamilyRow>(
    'SELECT id, name_ct, phone_ct, default_tone, avg_delay_days FROM family WHERE ledger_id = $1',
    [ledgerId],
  );

  const familyMap = new Map<string, FamilyRow>();
  for (const f of famRows) {
    familyMap.set(f.id, f);
  }

  // Calculate average days to pay across all families with history
  let totalDelay = 0;
  let delayCount = 0;
  for (const f of famRows) {
    if (f.avg_delay_days !== null) {
      totalDelay += Number(f.avg_delay_days);
      delayCount++;
    }
  }
  const avgDaysToPay = delayCount > 0 ? Math.round(totalDelay / delayCount) : 0;

  // Build who-owes list
  const list: FamilyWhoOwes[] = [];
  let totalOutstanding = 0;

  for (const [familyId, bal] of familyBalances.entries()) {
    if (bal.outstanding <= 0) continue;
    totalOutstanding += bal.outstanding;

    const fam = familyMap.get(familyId);
    let name = 'Family';
    let masked = '+•••••0000';
    let tone: 'friendly' | 'neutral' | 'firm' = 'neutral';

    if (fam) {
      try {
        name = decryptField(fieldKey, fam.name_ct, familyId, 'name_ct');
        const phone = decryptField(fieldKey, fam.phone_ct, familyId, 'phone_ct');
        masked = `+•••••${phone.slice(-4)}`;
        tone = fam.default_tone as any;
      } catch {
        name = 'Family';
      }
    }

    const daysOverdue = daysBetween(bal.oldestDue, todayIso);

    list.push({
      family_id: familyId,
      family_name: name,
      phone_masked: masked,
      outstanding_minor: bal.outstanding,
      oldest_unpaid_date: bal.oldestDue,
      total_invoiced_minor: bal.totalInvoiced,
      open_invoices_count: bal.invoiceCount,
      days_oldest_overdue: Math.max(0, daysOverdue),
      default_tone: tone,
    });
  }

  // Sort highest outstanding first
  list.sort((a, b) => b.outstanding_minor - a.outstanding_minor);

  const totalFamilies = list.length;
  const returnedList = showAll ? list : list.slice(0, limit);

  return {
    currency_code: currencyCode,
    total_outstanding_minor: totalOutstanding,
    families_owing_count: totalFamilies,
    average_days_to_pay: avgDaysToPay,
    families: returnedList,
    has_more: !showAll && totalFamilies > limit,
  };
}
