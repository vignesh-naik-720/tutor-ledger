// Recurring Bills & One-Off Expenses Domain Logic (FR-012, FR-033).
import { randomUUID } from 'node:crypto';
import { query } from '../db/client.js';

export interface RecurringBillItem {
  id: string;
  name: string;
  amount_minor: number;
  frequency: 'monthly';
  next_due_date: string;
  is_active: boolean;
}

export interface OneOffExpenseItem {
  id: string;
  description: string;
  amount_minor: number;
  expense_date: string;
}

export async function listBills(ledgerId: string): Promise<RecurringBillItem[]> {
  interface BillRow {
    id: string;
    name: string;
    amount_minor: string | number;
    frequency: string;
    next_due_date: string;
    is_active: boolean;
  }
  const rows = await query<BillRow>(
    `SELECT id, name, amount_minor, frequency, to_char(next_due_date, 'YYYY-MM-DD') AS next_due_date, is_active
       FROM recurring_bill
      WHERE ledger_id = $1
      ORDER BY next_due_date ASC`,
    [ledgerId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount_minor: Number(r.amount_minor),
    frequency: 'monthly',
    next_due_date: r.next_due_date,
    is_active: Boolean(r.is_active),
  }));
}

export async function createBill(
  ledgerId: string,
  name: string,
  amountMinor: number,
  nextDueDate: string,
): Promise<RecurringBillItem> {
  const id = randomUUID();
  await query(
    `INSERT INTO recurring_bill (id, ledger_id, name, amount_minor, frequency, next_due_date, is_active, is_sample_data)
     VALUES ($1, $2, $3, $4, 'monthly', $5, TRUE, FALSE)`,
    [id, ledgerId, name, amountMinor, nextDueDate],
  );
  return {
    id,
    name,
    amount_minor: amountMinor,
    frequency: 'monthly',
    next_due_date: nextDueDate,
    is_active: true,
  };
}

export async function listExpenses(ledgerId: string): Promise<OneOffExpenseItem[]> {
  interface ExpRow {
    id: string;
    description: string;
    amount_minor: string | number;
    expense_date: string;
  }
  const rows = await query<ExpRow>(
    `SELECT id, description, amount_minor, to_char(expense_date, 'YYYY-MM-DD') AS expense_date
       FROM one_off_expense
      WHERE ledger_id = $1
      ORDER BY expense_date ASC`,
    [ledgerId],
  );
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    amount_minor: Number(r.amount_minor),
    expense_date: r.expense_date,
  }));
}

export async function createExpense(
  ledgerId: string,
  description: string,
  amountMinor: number,
  expenseDate: string,
): Promise<OneOffExpenseItem> {
  const id = randomUUID();
  await query(
    `INSERT INTO one_off_expense (id, ledger_id, description, amount_minor, expense_date)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, ledgerId, description, amountMinor, expenseDate],
  );
  return {
    id,
    description,
    amount_minor: amountMinor,
    expense_date: expenseDate,
  };
}
