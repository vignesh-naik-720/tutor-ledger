// Recurring Bills & One-Off Expenses Routes (FR-012, FR-033)
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError, parseId, parseOrThrow, type ApiDeps } from '../http/apiCommon.js';
import { createBill, createExpense, listBills, listExpenses } from '../domain/bills.js';
import { moneyMinorSchema } from '../validation/index.js';

const billCreateSchema = z
  .object({
    name: z.string().min(1).max(100),
    amount_minor: moneyMinorSchema.min(0),
    next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const expenseCreateSchema = z
  .object({
    description: z.string().min(1).max(140),
    amount_minor: moneyMinorSchema.min(1),
    expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export async function billRoutes(app: FastifyInstance, _deps: ApiDeps): Promise<void> {
  // GET /bills
  app.get('/bills', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const bills = await listBills(ledgerId);
    return reply.send({ bills });
  });

  // POST /bills
  app.post('/bills', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(billCreateSchema, request.body);
    const bill = await createBill(ledgerId, body.name, body.amount_minor, body.next_due_date);
    return reply.code(201).send({ bill });
  });

  // GET /expenses
  app.get('/expenses', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const expenses = await listExpenses(ledgerId);
    return reply.send({ expenses });
  });

  // POST /expenses
  app.post('/expenses', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(expenseCreateSchema, request.body);
    const expense = await createExpense(ledgerId, body.description, body.amount_minor, body.expense_date);
    return reply.code(201).send({ expense });
  });
}
