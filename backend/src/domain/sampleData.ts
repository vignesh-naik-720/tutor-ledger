// Sample data generator for Tutor Ledger (FR-014).
// Loads 12 realistic families, 2 recurring bill cycles, past invoices & payments,
// and a week 7 cash dip, clearly labelled as is_sample_data = TRUE.

import { randomUUID } from 'node:crypto';
import { query } from '../db/client.js';
import { encryptField } from '../security/fieldCrypto.js';
import { normalisePhone } from '../validation/phone.js';
import { addDays } from './invoiceGenerate.js';

interface SampleFamilyDef {
  name: string;
  phone: string;
  feeMinor: number;
  termDays: number;
  tone: 'friendly' | 'neutral' | 'firm';
  avgDelay: number | null;
  paymentCount: number;
  unpaidStatus?: 'overdue' | 'due_soon' | 'paid';
  overdueDays?: number;
  partialPaidMinor?: number;
}

const SAMPLE_FAMILIES: SampleFamilyDef[] = [
  {
    name: 'Sharma Family (Aarav - 10th Maths)',
    phone: '+919876543210',
    feeMinor: 450000, // ₹4,500
    termDays: 7,
    tone: 'friendly',
    avgDelay: 12, // Chronic late payer
    paymentCount: 6,
    unpaidStatus: 'overdue',
    overdueDays: 14,
  },
  {
    name: 'Verma Family (Ananya - 12th Physics)',
    phone: '+919876543211',
    feeMinor: 600000, // ₹6,000
    termDays: 10,
    tone: 'neutral',
    avgDelay: 18,
    paymentCount: 4,
    unpaidStatus: 'overdue',
    overdueDays: 9,
    partialPaidMinor: 250000, // ₹2,500 paid, ₹3,500 remaining
  },
  {
    name: 'Patel Family (Rohan - 9th Science)',
    phone: '+919876543212',
    feeMinor: 400000, // ₹4,000
    termDays: 7,
    tone: 'firm',
    avgDelay: 22,
    paymentCount: 5,
    unpaidStatus: 'overdue',
    overdueDays: 21,
  },
  {
    name: 'Gupta Family (Diya - 11th Chemistry)',
    phone: '+919876543213',
    feeMinor: 500000, // ₹5,000
    termDays: 7,
    tone: 'friendly',
    avgDelay: null, // Thin history: new family
    paymentCount: 1,
    unpaidStatus: 'overdue',
    overdueDays: 5,
  },
  {
    name: 'Iyer Family (Vihaan - 8th Foundation)',
    phone: '+919876543214',
    feeMinor: 350000,
    termDays: 14,
    tone: 'friendly',
    avgDelay: 2, // Very prompt payer
    paymentCount: 8,
    unpaidStatus: 'paid',
  },
  {
    name: 'Rao Family (Ishaan - 10th Science)',
    phone: '+919876543215',
    feeMinor: 450000,
    termDays: 7,
    tone: 'neutral',
    avgDelay: 1,
    paymentCount: 7,
    unpaidStatus: 'paid',
  },
  {
    name: 'Nair Family (Meera - 12th Maths)',
    phone: '+919876543216',
    feeMinor: 600000,
    termDays: 10,
    tone: 'friendly',
    avgDelay: 3,
    paymentCount: 5,
    unpaidStatus: 'due_soon',
  },
  {
    name: 'Singh Family (Kabir - 9th Maths)',
    phone: '+919876543217',
    feeMinor: 400000,
    termDays: 7,
    tone: 'neutral',
    avgDelay: 5,
    paymentCount: 4,
    unpaidStatus: 'paid',
  },
  {
    name: 'Joshi Family (Tanvi - 10th English & SST)',
    phone: '+919876543218',
    feeMinor: 350000,
    termDays: 7,
    tone: 'friendly',
    avgDelay: 0,
    paymentCount: 9,
    unpaidStatus: 'paid',
  },
  {
    name: 'Deshmukh Family (Aditya - 11th Maths)',
    phone: '+919876543219',
    feeMinor: 550000,
    termDays: 10,
    tone: 'neutral',
    avgDelay: null, // Zero history
    paymentCount: 0,
    unpaidStatus: 'due_soon',
  },
  {
    name: 'Kulkarni Family (Sneha - 8th Maths)',
    phone: '+919876543220',
    feeMinor: 350000,
    termDays: 7,
    tone: 'friendly',
    avgDelay: 4,
    paymentCount: 6,
    unpaidStatus: 'paid',
  },
  {
    name: 'Reddy Family (Arjun - 12th Biology)',
    phone: '+919876543221',
    feeMinor: 550000,
    termDays: 10,
    tone: 'friendly',
    avgDelay: 2,
    paymentCount: 6,
    unpaidStatus: 'paid',
  },
];

export async function loadSampleData(ledgerId: string, fieldKey: Buffer): Promise<{
  familiesCount: number;
  invoicesCount: number;
  billsCount: number;
}> {
  const today = new Date().toISOString().slice(0, 10);

  // Set opening balance and min threshold
  await query(
    `UPDATE ledger
        SET opening_balance_minor = 3500000,
            minimum_balance_minor = 2000000,
            currency_code = 'INR',
            currency_exponent = 2,
            is_sample_data = TRUE
      WHERE id = $1`,
    [ledgerId],
  );

  let familiesCount = 0;
  let invoicesCount = 0;

  for (const def of SAMPLE_FAMILIES) {
    const familyId = randomUUID();
    const e164 = normalisePhone(def.phone) || def.phone;
    const nameCt = encryptField(fieldKey, def.name, familyId, 'name_ct');
    const phoneCt = encryptField(fieldKey, e164, familyId, 'phone_ct');
    const phoneHash = Buffer.from(e164);

    await query(
      `INSERT INTO family (id, ledger_id, name_ct, phone_ct, phone_digits_hash, default_fee_minor,
                           default_term_days, default_tone, avg_delay_days, payment_count, is_sample_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)`,
      [
        familyId,
        ledgerId,
        nameCt,
        phoneCt,
        phoneHash,
        def.feeMinor,
        def.termDays,
        def.tone,
        def.avgDelay,
        def.paymentCount,
      ],
    );
    familiesCount++;

    // Create an active invoice based on def.unpaidStatus
    const invId = randomUUID();
    if (def.unpaidStatus === 'overdue') {
      const issueDate = addDays(today, -(def.overdueDays! + def.termDays));
      const dueDate = addDays(today, -def.overdueDays!);
      const status = def.partialPaidMinor ? 'partially-paid' : 'open';

      await query(
        `INSERT INTO invoice (id, ledger_id, family_id, period_start, period_end, amount_minor,
                              issue_date, due_date, status, version, is_sample_data)
         VALUES ($1, $2, $3, $4, $4, $5, $4, $6, $7, 1, TRUE)`,
        [invId, ledgerId, familyId, issueDate, def.feeMinor, dueDate, status],
      );
      invoicesCount++;

      // If partial, record payment
      if (def.partialPaidMinor) {
        await query(
          `INSERT INTO payment (id, ledger_id, family_id, invoice_id, client_event_id, amount_minor,
                                date_received, source, was_offline, is_sample_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'owner_entry', FALSE, TRUE)`,
          [
            randomUUID(),
            ledgerId,
            familyId,
            invId,
            randomUUID(),
            def.partialPaidMinor,
            addDays(dueDate, -2),
          ],
        );
      }
    } else if (def.unpaidStatus === 'due_soon') {
      const issueDate = addDays(today, -2);
      const dueDate = addDays(today, def.termDays - 2);

      await query(
        `INSERT INTO invoice (id, ledger_id, family_id, period_start, period_end, amount_minor,
                              issue_date, due_date, status, version, is_sample_data)
         VALUES ($1, $2, $3, $4, $4, $5, $4, $6, 'open', 1, TRUE)`,
        [invId, ledgerId, familyId, issueDate, def.feeMinor, dueDate],
      );
      invoicesCount++;
    } else {
      // Paid invoice
      const issueDate = addDays(today, -25);
      const dueDate = addDays(today, -18);

      await query(
        `INSERT INTO invoice (id, ledger_id, family_id, period_start, period_end, amount_minor,
                              issue_date, due_date, status, version, is_sample_data)
         VALUES ($1, $2, $3, $4, $4, $5, $4, $6, 'paid', 1, TRUE)`,
        [invId, ledgerId, familyId, issueDate, def.feeMinor, dueDate],
      );
      invoicesCount++;

      // Record full payment
      await query(
        `INSERT INTO payment (id, ledger_id, family_id, invoice_id, client_event_id, amount_minor,
                              date_received, source, was_offline, is_sample_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'owner_entry', FALSE, TRUE)`,
        [
          randomUUID(),
          ledgerId,
          familyId,
          invId,
          randomUUID(),
          def.feeMinor,
          addDays(dueDate, def.avgDelay ?? 1),
        ],
      );
    }
  }

  // 2 Bill Cycles (FR-014)
  // Bill 1: Tuition Room Rent ₹12,000/mo due 1st of month
  await query(
    `INSERT INTO recurring_bill (id, ledger_id, name, amount_minor, frequency, next_due_date, is_active, is_sample_data)
     VALUES ($1, $2, 'Tuition Classroom Rent & Power', 1200000, 'monthly', $3, TRUE, TRUE)`,
    [randomUUID(), ledgerId, addDays(today, 5)],
  );

  // Bill 2: Internet & LMS teaching tools ₹2,500/mo
  await query(
    `INSERT INTO recurring_bill (id, ledger_id, name, amount_minor, frequency, next_due_date, is_active, is_sample_data)
     VALUES ($1, $2, 'High-Speed Broadband & Zoom LMS', 250000, 'monthly', $3, TRUE, TRUE)`,
    [randomUUID(), ledgerId, addDays(today, 12)],
  );

  // Week 7 Cash Dip: Special Workshop & Annual Prep Materials ₹22,000 in week 7 (+45 days)
  await query(
    `INSERT INTO one_off_expense (id, ledger_id, description, amount_minor, expense_date)
     VALUES ($1, $2, 'Annual Mock Test Prints & Science Lab Kits (Week 7 Dip)', 2200000, $3)`,
    [randomUUID(), ledgerId, addDays(today, 45)],
  );

  return {
    familiesCount,
    invoicesCount,
    billsCount: 2,
  };
}

export async function removeSampleData(ledgerId: string): Promise<{ deleted: number }> {
  // Delete only records flagged is_sample_data = TRUE (Story 2 acceptance 4)
  await query('DELETE FROM payment WHERE ledger_id = $1 AND is_sample_data = TRUE', [ledgerId]);
  await query('DELETE FROM invoice WHERE ledger_id = $1 AND is_sample_data = TRUE', [ledgerId]);
  await query('DELETE FROM family WHERE ledger_id = $1 AND is_sample_data = TRUE', [ledgerId]);
  await query('DELETE FROM recurring_bill WHERE ledger_id = $1 AND is_sample_data = TRUE', [ledgerId]);
  await query('DELETE FROM one_off_expense WHERE ledger_id = $1 AND description LIKE $2', [ledgerId, '%Week 7 Dip%']);
  await query('UPDATE ledger SET is_sample_data = FALSE WHERE id = $1', [ledgerId]);

  return { deleted: 1 };
}
