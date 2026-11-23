// What-If Scenarios Routes (FR-036..FR-038)
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { ApiError, parseId, parseOrThrow, type ApiDeps } from '../http/apiCommon.js';

const scenarioCreateSchema = z
  .object({
    name: z.string().min(1).max(80),
    type: z.enum([
      'builtin_late_payment',
      'builtin_family_leaves',
      'builtin_new_family',
      'builtin_bill_rise',
      'combination',
      'custom',
    ]),
    parameters: z.record(z.any()),
    is_on: z.boolean().default(false),
  })
  .strict();

const scenarioPatchSchema = z
  .object({
    is_on: z.boolean().optional(),
    name: z.string().min(1).max(80).optional(),
    parameters: z.record(z.any()).optional(),
  })
  .strict();

export async function scenarioRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  // GET /scenarios
  app.get('/scenarios', async (request, reply) => {
    const ledgerId = request.ledgerId;

    interface ScenRow {
      id: string;
      name: string;
      type: string;
      parameters: any;
      is_on: boolean;
    }

    let rows = await query<ScenRow>(
      'SELECT id, name, type, parameters, is_on FROM scenario WHERE ledger_id = $1 ORDER BY name ASC',
      [ledgerId],
    );

    // If no scenarios exist yet, seed default built-in scenarios (FR-036)
    if (rows.length === 0) {
      // Find a sample family ID if available
      const fams = await query<{ id: string }>('SELECT id FROM family WHERE ledger_id = $1 LIMIT 1', [ledgerId]);
      const sampleFamId = fams[0]?.id || 'sharma-fam';

      const builtins = [
        {
          name: 'Key Family Pays 15 Days Late',
          type: 'builtin_late_payment',
          parameters: { latePayment: { familyId: sampleFamId, delayDays: 15 } },
          is_on: false,
        },
        {
          name: 'Study Room Rent Rises by 15%',
          type: 'builtin_bill_rise',
          parameters: { billRise: { percentBp: 1500 } },
          is_on: false,
        },
        {
          name: 'New Grade 10 Student Joins Next Week',
          type: 'builtin_new_family',
          parameters: {
            newFamily: {
              name: 'Gupta Family',
              startDate: new Date().toISOString().slice(0, 10),
              feeMinor: 450000,
              termDays: 7,
            },
          },
          is_on: false,
        },
        {
          name: 'Family Leaves at Month End',
          type: 'builtin_family_leaves',
          parameters: {
            familyLeaves: {
              familyId: sampleFamId,
              effectiveDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            },
          },
          is_on: false,
        },
      ];

      for (const b of builtins) {
        await query(
          'INSERT INTO scenario (id, ledger_id, name, type, parameters, is_on) VALUES ($1, $2, $3, $4, $5, $6)',
          [randomUUID(), ledgerId, b.name, b.type, b.parameters, b.is_on],
        );
      }

      rows = await query<ScenRow>(
        'SELECT id, name, type, parameters, is_on FROM scenario WHERE ledger_id = $1 ORDER BY name ASC',
        [ledgerId],
      );
    }

    return reply.send({
      scenarios: rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters,
        is_on: Boolean(r.is_on),
      })),
    });
  });

  // POST /scenarios (Create custom scenario)
  app.post('/scenarios', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(scenarioCreateSchema, request.body);
    const id = randomUUID();

    await query(
      'INSERT INTO scenario (id, ledger_id, name, type, parameters, is_on) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, ledgerId, body.name, body.type, body.parameters, body.is_on],
    );

    return reply.code(201).send({
      scenario: {
        id,
        name: body.name,
        type: body.type,
        parameters: body.parameters,
        is_on: body.is_on,
      },
    });
  });

  // PATCH /scenarios/:id (Toggle on/off)
  app.patch('/scenarios/:id', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const id = parseId((request.params as { id?: unknown }).id);
    const body = parseOrThrow(scenarioPatchSchema, request.body);

    const existing = await query<{ id: string }>('SELECT id FROM scenario WHERE id = $1 AND ledger_id = $2', [
      id,
      ledgerId,
    ]);
    if (existing.length === 0) throw new ApiError(404, 'NOT_FOUND');

    if (body.is_on !== undefined) {
      await query('UPDATE scenario SET is_on = $3 WHERE id = $1 AND ledger_id = $2', [id, ledgerId, body.is_on]);
    }
    if (body.name !== undefined) {
      await query('UPDATE scenario SET name = $3 WHERE id = $1 AND ledger_id = $2', [id, ledgerId, body.name]);
    }

    return reply.send({ status: 'ok', id, is_on: body.is_on });
  });
}
