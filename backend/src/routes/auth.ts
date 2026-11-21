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
    password: z.string().min(1).max(128),
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
      password_hash: string;
      failed_login_count: number;
      locked_until: string | null;
    }

    const owners = await query<OwnerRow>(
      'SELECT id, ledger_id, password_hash, failed_login_count, locked_until FROM owner_account LIMIT 1',
    );
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

    reply.setCookie('__Host-tl_session', session.sessionId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    return reply.send({
      status: 'ok',
      idle_timeout_seconds: 900,
      csrf_token: session.csrfToken,
      ledger_id: owner.ledger_id,
    });
  });

  // POST /auth/logout
  app.post('/auth/logout', async (request, reply) => {
    const rawCookie = request.cookies['__Host-tl_session'];
    if (rawCookie) {
      await destroySession(rawCookie, deps.pepper);
    }
    reply.clearCookie('__Host-tl_session', { path: '/' });
    return reply.send({ status: 'ok' });
  });

  // GET /auth/session
  app.get('/auth/session', async (request, reply) => {
    const rawCookie = request.cookies['__Host-tl_session'];
    if (!rawCookie) {
      throw new ApiError(401, 'UNAUTHENTICATED');
    }

    const sess = await resolveSession(rawCookie, deps.pepper);
    if (!sess) {
      throw new ApiError(401, 'SESSION_EXPIRED');
    }

    return reply.send({
      status: 'active',
      ledger_id: sess.ledgerId,
      csrf_token: sess.csrfToken,
      idle_timeout_seconds: 900,
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
