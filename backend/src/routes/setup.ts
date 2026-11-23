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
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).default('Demo Tutor'),
    email: z.string().trim().email('Please enter a valid email address').max(255).default('sarah.jenkins@tutorledger.com'),
    dob: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined))
      .refine((val) => {
        if (!val) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
        const d = new Date(val);
        if (isNaN(d.getTime())) return false;
        const now = new Date();
        const ageYears = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return ageYears >= 16 && ageYears <= 110;
      }, 'You must be at least 16 years old'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    currency_code: z.string().length(3).default('INR'),
    owner_timezone: z.string().default('Asia/Kolkata'),
    opening_balance_minor: z.number().int().default(0),
    minimum_balance_minor: z.number().int().min(0).default(1000000), // Default ₹10,000
    load_sample_data: z.boolean().default(true),
    setup_secret: z.string().optional(),
  })
  .strict();

export async function setupRoutes(app: FastifyInstance, deps: ApiDeps, setupSecret: string): Promise<void> {
  // GET /setup/status (public)
  app.get('/setup/status', async (_request, reply) => {
    const owners = await query<{ id: string; ledger_id: string; email: string | null; name: string | null }>(
      'SELECT id, ledger_id, email, name FROM owner_account LIMIT 1',
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
      default_email: owners[0]?.email ?? null,
      default_name: owners[0]?.name ?? null,
    });
  });

  // Handler for creating a new tutor owner account (used by /setup/owner and /auth/signup)
  async function handleRegisterOwner(request: any, reply: any) {
    const body = parseOrThrow(ownerSetupSchema, request.body);

    // If setup_secret is provided and invalid, verify it; otherwise permit direct signup
    if (body.setup_secret && body.setup_secret !== setupSecret) {
      throw new ApiError(403, 'FORBIDDEN');
    }

    // Check if this email is already registered
    const normalizedEmail = body.email.trim().toLowerCase();
    const existing = await query<{ id: string }>(
      'SELECT id FROM owner_account WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [normalizedEmail],
    );
    if (existing.length > 0) {
      throw new ApiError(409, 'CONFLICT');
    }

    const ledgerId = randomUUID();
    const ownerId = randomUUID();
    const pwHash = await hashPassword(body.password, deps.pepper);

    // Create personal ledger for this tutor
    await query(
      `INSERT INTO ledger (id, currency_code, currency_exponent, owner_timezone, minimum_balance_minor, opening_balance_minor, is_sample_data)
       VALUES ($1, $2, 2, $3, $4, $5, FALSE)`,
      [ledgerId, body.currency_code.toUpperCase(), body.owner_timezone, body.minimum_balance_minor, body.opening_balance_minor],
    );

    // Create owner account with name, email, and dob
    await query(
      `INSERT INTO owner_account (id, ledger_id, name, email, dob, password_hash, failed_login_count, session_idle_minutes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 15, now())`,
      [ownerId, ledgerId, body.name.trim(), normalizedEmail, body.dob ?? null, pwHash],
    );

    await writeAuditEvent(
      { ledgerId, actor: 'system', actionCode: 'OWNER_CREATED', subjectType: 'ledger', subjectId: ledgerId },
      deps.auditHmacKey,
    );

    // Auto-populate 12 sample families, invoices, recurring bills, and 13-week forecast
    if (body.load_sample_data !== false) {
      try {
        await loadSampleData(ledgerId, deps.fieldKey);
      } catch (sampleErr) {
        console.warn('Could not auto-seed sample data:', sampleErr);
      }
    }

    // Create immediate session so the owner is signed in right away
    const session = await createSession(ledgerId, deps.pepper);
    const isHttps = request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https';
    reply.setCookie('tl_session', session.sessionId, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
    });
    if (!isHttps) {
      reply.clearCookie('__Host-tl_session', { path: '/' });
    } else {
      reply.setCookie('__Host-tl_session', session.sessionId, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      });
    }

    return reply.code(201).send({
      status: 'created',
      ledger_id: ledgerId,
      csrf_token: session.csrfToken,
      owner: {
        id: ownerId,
        name: body.name.trim(),
        email: normalizedEmail,
        dob: body.dob ?? null,
      },
    });
  }

  // POST /setup/owner
  app.post('/setup/owner', handleRegisterOwner);

  // POST /auth/signup (Standard user registration)
  app.post('/auth/signup', handleRegisterOwner);

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
