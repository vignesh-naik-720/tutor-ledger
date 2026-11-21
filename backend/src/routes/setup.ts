// Setup & Sample Data routes (FR-011..FR-015, contracts/api.md)
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword } from '../auth/password.js';
import { createSession } from '../auth/session.js';
import { query } from '../db/client.js';
import { ApiError, parseOrThrow, type ApiDeps } from '../http/apiCommon.js';
import { loadSampleData, removeSampleData } from '../domain/sampleData.js';
import { writeAuditEvent } from '../audit/auditWriter.js';

const ownerSetupSchema = z
  .object({
    setup_secret: z.string().min(1),
    password: z.string().min(12).max(128),
    currency_code: z.string().length(3).default('INR'),
    owner_timezone: z.string().default('Asia/Kolkata'),
    opening_balance_minor: z.number().int().default(0),
    minimum_balance_minor: z.number().int().min(0).default(1000000), // Default ₹10,000
  })
  .strict();

export async function setupRoutes(app: FastifyInstance, deps: ApiDeps, setupSecret: string): Promise<void> {
  // GET /setup/status (public)
  app.get('/setup/status', async (_request, reply) => {
    const owners = await query<{ id: string; ledger_id: string }>(
      'SELECT id, ledger_id FROM owner_account LIMIT 1',
    );
    const exists = owners.length > 0;
    let isSample = false;
    let currencyCode = 'INR';

    if (exists && owners[0]) {
      const ledgers = await query<{ is_sample_data: boolean; currency_code: string }>(
        'SELECT is_sample_data, currency_code FROM ledger WHERE id = $1',
        [owners[0].ledger_id],
      );
      if (ledgers[0]) {
        isSample = Boolean(ledgers[0].is_sample_data);
        currencyCode = ledgers[0].currency_code || 'INR';
      }
    }

    return reply.send({
      owner_exists: exists,
      is_sample_data: isSample,
      currency_code: currencyCode,
    });
  });

  // POST /setup/owner (public with setup_secret; disabled after first owner exists)
  app.post('/setup/owner', async (request, reply) => {
    const owners = await query<{ id: string }>('SELECT id FROM owner_account LIMIT 1');
    if (owners.length > 0) {
      throw new ApiError(409, 'CONFLICT'); // Fail closed once owner exists
    }

    const body = parseOrThrow(ownerSetupSchema, request.body);
    if (body.setup_secret !== setupSecret) {
      throw new ApiError(403, 'FORBIDDEN');
    }

    const ledgerId = randomUUID();
    const ownerId = randomUUID();
    const pwHash = await hashPassword(body.password, deps.pepper);

    // Create ledger
    await query(
      `INSERT INTO ledger (id, currency_code, currency_exponent, owner_timezone, minimum_balance_minor, opening_balance_minor, is_sample_data)
       VALUES ($1, $2, 2, $3, $4, $5, FALSE)`,
      [ledgerId, body.currency_code.toUpperCase(), body.owner_timezone, body.minimum_balance_minor, body.opening_balance_minor],
    );

    // Create owner
    await query(
      `INSERT INTO owner_account (id, ledger_id, password_hash, failed_login_count, session_idle_minutes, created_at)
       VALUES ($1, $2, $3, 0, 15, now())`,
      [ownerId, ledgerId, pwHash],
    );

    await writeAuditEvent(
      { ledgerId, actor: 'system', actionCode: 'OWNER_CREATED', subjectType: 'ledger', subjectId: ledgerId },
      deps.auditHmacKey,
    );

    // Create immediate session so the owner is signed in right away
    const session = await createSession(ledgerId, deps.pepper);
    reply.setCookie('__Host-tl_session', session.sessionId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    return reply.code(201).send({
      status: 'created',
      ledger_id: ledgerId,
      csrf_token: session.csrfToken,
    });
  });

  // POST /setup/sample-data
  app.post('/setup/sample-data', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const result = await loadSampleData(ledgerId, deps.fieldKey);
    await writeAuditEvent(
      { ledgerId, actor: 'owner', actionCode: 'SAMPLE_DATA_LOADED', subjectType: 'ledger', subjectId: ledgerId },
      deps.auditHmacKey,
    );
    return reply.send({ status: 'ok', ...result });
  });

  // DELETE /setup/sample-data
  app.delete('/setup/sample-data', async (request, reply) => {
    const ledgerId = request.ledgerId;
    await removeSampleData(ledgerId);
    await writeAuditEvent(
      { ledgerId, actor: 'owner', actionCode: 'SAMPLE_DATA_REMOVED', subjectType: 'ledger', subjectId: ledgerId },
      deps.auditHmacKey,
    );
    return reply.send({ status: 'ok' });
  });
}
