import { constantTimeEqual } from '../auth/session.js';

// CSRF and Origin checks (T023). Every mutation needs X-CSRF-Token matching the session
// token AND an Origin header equal to the configured app origin. ledger_id is never read here.

export const MUTATING_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type CsrfFailure = 'ORIGIN_MISSING' | 'ORIGIN_MISMATCH' | 'TOKEN_MISSING' | 'TOKEN_MISMATCH';

export function checkCsrf(input: {
  method: string;
  origin: string | undefined;
  expectedOrigin: string;
  csrfHeader: string | undefined;
  sessionCsrfToken: string;
}): { ok: true } | { ok: false; reason: CsrfFailure } {
  if (!MUTATING_METHODS.has(input.method.toUpperCase())) return { ok: true };
  if (!input.origin) return { ok: false, reason: 'ORIGIN_MISSING' };
  if (input.origin !== input.expectedOrigin) return { ok: false, reason: 'ORIGIN_MISMATCH' };
  if (!input.csrfHeader) return { ok: false, reason: 'TOKEN_MISSING' };
  if (!constantTimeEqual(input.csrfHeader, input.sessionCsrfToken)) {
    return { ok: false, reason: 'TOKEN_MISMATCH' };
  }
  return { ok: true };
}
