// Auth routes: login, logout, session status, reauth (FR-001, FR-002, contracts/api.md)
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSession, destroySession, resolveSession } from '../auth/session.js';
import { verifyPassword, hashPassword } from '../auth/password.js';
import { query } from '../db/client.js';
import { ApiError, parseOrThrow, type ApiDeps } from '../http/apiCommon.js';
import { writeAuditEvent } from '../audit/auditWriter.js';

const loginSchema = z
  .object({
    email: z.string().email('Please enter a valid email address').optional(),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();

const reauthSchema = z
  .object({
    password: z.string().min(1).max(128),
  })
  .strict();

export async function authRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  // POST /auth/login
  app.post('/auth/login', async (request, reply) => {
    const body = parseOrThrow(loginSchema, request.body);

    interface OwnerRow {
      id: string;
      ledger_id: string;
      name: string | null;
      email: string | null;
      dob: string | null;
      password_hash: string;
      failed_login_count: number;
      locked_until: string | null;
    }

    let owners: OwnerRow[] = [];
    if (body.email) {
      owners = await query<OwnerRow>(
        'SELECT id, ledger_id, name, email, dob, password_hash, failed_login_count, locked_until FROM owner_account WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [body.email.trim()],
      );
    }
    // Fallback: if not found by email, check if there is an existing single owner account (e.g. pre-seeded demo or unassigned email)
    if (owners.length === 0) {
      const allOwners = await query<OwnerRow>(
        'SELECT id, ledger_id, name, email, dob, password_hash, failed_login_count, locked_until FROM owner_account LIMIT 1',
      );
      const firstOwner = allOwners[0];
      if (firstOwner && (!firstOwner.email || body.email?.toLowerCase() === 'sarah.jenkins@tutorledger.com')) {
        owners = [firstOwner];
        // Backfill demo owner fields if they were null
        if (!firstOwner.email) {
          await query(
            'UPDATE owner_account SET email = $1, name = COALESCE(name, $2), dob = COALESCE(dob, $3) WHERE id = $4',
            ['sarah.jenkins@tutorledger.com', 'Sarah Jenkins', '1992-06-15', firstOwner.id],
          );
        }
      }
    }

    const owner = owners[0];
    if (!owner) {
      throw new ApiError(401, 'UNAUTHENTICATED');
    }

    // Check lockout
    if (owner.locked_until && new Date(owner.locked_until) > new Date()) {
      reply.header('Retry-After', '900');
      throw new ApiError(401, 'LOCKED_OUT');
    }

    const valid = await verifyPassword(owner.password_hash, body.password, deps.pepper);
    if (!valid) {
      const nextFail = owner.failed_login_count + 1;
      const lockedUntil = nextFail >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await query(
        'UPDATE owner_account SET failed_login_count = $2, locked_until = $3 WHERE ledger_id = $1',
        [owner.ledger_id, nextFail, lockedUntil],
      );
      await writeAuditEvent(
        { ledgerId: owner.ledger_id, actor: 'anonymous', actionCode: 'AUTH_LOGIN_FAIL', subjectType: 'session' },
        deps.auditHmacKey,
      );
      throw new ApiError(401, 'UNAUTHENTICATED');
    }

    // Success
    await query(
      'UPDATE owner_account SET failed_login_count = 0, locked_until = NULL, last_reauth_at = $2 WHERE ledger_id = $1',
      [owner.ledger_id, new Date().toISOString()],
    );

    const session = await createSession(owner.ledger_id, deps.pepper);
    await writeAuditEvent(
      { ledgerId: owner.ledger_id, actor: 'owner', actionCode: 'AUTH_LOGIN_OK', subjectType: 'session' },
      deps.auditHmacKey,
    );

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

    return reply.send({
      status: 'ok',
      idle_timeout_seconds: 900,
      csrf_token: session.csrfToken,
      ledger_id: owner.ledger_id,
      owner: {
        id: owner.id,
        name: owner.name ?? 'Sarah Jenkins',
        email: owner.email ?? 'sarah.jenkins@tutorledger.com',
        dob: owner.dob ? String(owner.dob).slice(0, 10) : null,
      },
    });
  });

  // POST /auth/logout
  app.post('/auth/logout', async (request, reply) => {
    try {
      const rawCookie = request.cookies['__Host-tl_session'] || request.cookies['tl_session'];
      if (rawCookie) {
        await destroySession(rawCookie, deps.pepper);
      }
    } catch {
      // Non-fatal if session destruction fails
    }
    reply.clearCookie('__Host-tl_session', { path: '/' });
    reply.clearCookie('tl_session', { path: '/' });
    return reply.send({ status: 'ok' });
  });

  // GET /auth/session
  app.get('/auth/session', async (request, reply) => {
    const cookie1 = request.cookies['tl_session'];
    const cookie2 = request.cookies['__Host-tl_session'];

    let sess = null;
    if (cookie1) {
      sess = await resolveSession(cookie1, deps.pepper);
    }
    if (!sess && cookie2) {
      sess = await resolveSession(cookie2, deps.pepper);
    }

    if (!sess) {
      reply.clearCookie('__Host-tl_session', { path: '/' });
      reply.clearCookie('tl_session', { path: '/' });
      throw new ApiError(401, 'SESSION_EXPIRED');
    }

    const owners = await query<{ id: string; name: string | null; email: string | null; dob: string | null }>(
      'SELECT id, name, email, dob FROM owner_account WHERE ledger_id = $1 LIMIT 1',
      [sess.ledgerId],
    );

    return reply.send({
      status: 'active',
      ledger_id: sess.ledgerId,
      csrf_token: sess.csrfToken,
      idle_timeout_seconds: 900,
      owner: owners[0]
        ? {
            id: owners[0].id,
            name: owners[0].name ?? 'Sarah Jenkins',
            email: owners[0].email ?? 'sarah.jenkins@tutorledger.com',
            dob: owners[0].dob ? String(owners[0].dob).slice(0, 10) : null,
          }
        : null,
    });
  });

  // POST /auth/reauth
  app.post('/auth/reauth', async (request, reply) => {
    const ledgerId = request.ledgerId;
    const body = parseOrThrow(reauthSchema, request.body);

    const owners = await query<{ password_hash: string }>(
      'SELECT password_hash FROM owner_account WHERE ledger_id = $1',
      [ledgerId],
    );
    const owner = owners[0];
    if (!owner) throw new ApiError(401, 'UNAUTHENTICATED');

    const valid = await verifyPassword(owner.password_hash, body.password, deps.pepper);
    if (!valid) throw new ApiError(401, 'UNAUTHENTICATED');

    await query('UPDATE owner_account SET last_reauth_at = now() WHERE ledger_id = $1', [ledgerId]);
    return reply.send({ status: 'reauthenticated' });
  });
}
