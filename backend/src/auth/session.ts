import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { query } from '../db/client.js';

// Server-side sessions (T020). Cookie: __Host-tl_session; HttpOnly, Secure, SameSite=Strict, Path=/.
// Only a peppered SHA-256 hash of the session identifier is stored.

export const SESSION_COOKIE = '__Host-tl_session';
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000;

export interface SessionContext {
  ledgerId: string;
  csrfToken: string;
  absoluteExpiresAt: Date;
  lastSeenAt: Date;
}

export function hashSessionId(sessionId: string, pepper: string): Buffer {
  return createHmac('sha256', pepper).update(sessionId).digest();
}

export function deriveCsrfToken(sessionId: string, pepper: string): string {
  return createHmac('sha256', pepper).update(`csrf:${sessionId}`).digest('base64url');
}

export function newSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function sessionCookieOptions(): {
  httpOnly: true;
  secure: true;
  sameSite: 'strict';
  path: '/';
} {
  return { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };
}

/** Pure expiry check used by the middleware and by tests. */
export function isSessionExpired(
  now: Date,
  lastSeenAt: Date,
  absoluteExpiresAt: Date,
): 'ok' | 'idle' | 'absolute' {
  if (now.getTime() >= absoluteExpiresAt.getTime()) return 'absolute';
  if (now.getTime() - lastSeenAt.getTime() > IDLE_TIMEOUT_MS) return 'idle';
  return 'ok';
}

export async function createSession(ledgerId: string, pepper: string, now = new Date()): Promise<{
  sessionId: string;
  csrfToken: string;
}> {
  const sessionId = newSessionId();
  const idHash = hashSessionId(sessionId, pepper);
  const csrfToken = deriveCsrfToken(sessionId, pepper);
  const csrfSecretHash = createHash('sha256').update(csrfToken).digest();
  const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_LIFETIME_MS);
  await query(
    `INSERT INTO session (id_hash, ledger_id, created_at, last_seen_at, absolute_expires_at, csrf_secret_hash)
     VALUES ($1, $2, $3, $3, $4, $5)`,
    [idHash, ledgerId, now, absoluteExpiresAt, csrfSecretHash],
  );
  return { sessionId, csrfToken };
}

interface SessionRow extends QueryResultRow {
  ledger_id: string;
  last_seen_at: Date;
  absolute_expires_at: Date;
}

/** Resolves a session server-side. Returns null when missing or expired (fail closed). */
export async function resolveSession(
  sessionId: string,
  pepper: string,
  now = new Date(),
): Promise<SessionContext | null> {
  const idHash = hashSessionId(sessionId, pepper);
  const rows = await query<SessionRow>(
    'SELECT ledger_id, last_seen_at, absolute_expires_at FROM session WHERE id_hash = $1',
    [idHash],
  );
  const row = rows[0];
  if (!row) return null;
  if (isSessionExpired(now, row.last_seen_at, row.absolute_expires_at) !== 'ok') {
    await query('DELETE FROM session WHERE id_hash = $1', [idHash]);
    return null;
  }
  await query('UPDATE session SET last_seen_at = $2 WHERE id_hash = $1', [idHash, now]);
  return {
    ledgerId: row.ledger_id,
    csrfToken: deriveCsrfToken(sessionId, pepper),
    absoluteExpiresAt: row.absolute_expires_at,
    lastSeenAt: now,
  };
}

export async function destroySession(sessionId: string, pepper: string): Promise<void> {
  await query('DELETE FROM session WHERE id_hash = $1', [hashSessionId(sessionId, pepper)]);
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
