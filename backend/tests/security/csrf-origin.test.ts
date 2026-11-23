import { describe, expect, it } from 'vitest';
import { checkCsrf } from '../../src/security/csrf.js';

// S-10: CSRF token and Origin rejection on every mutation (constitution V).
const base = {
  expectedOrigin: 'https://ledger.example',
  sessionCsrfToken: 'token-abc-123',
};

describe('S-10 CSRF and Origin', () => {
  it('accepts a POST with matching Origin and token', () => {
    const r = checkCsrf({ ...base, method: 'POST', origin: base.expectedOrigin, csrfHeader: base.sessionCsrfToken });
    expect(r.ok).toBe(true);
  });

  it('rejects a POST with a foreign Origin', () => {
    const r = checkCsrf({ ...base, method: 'POST', origin: 'https://evil.example', csrfHeader: base.sessionCsrfToken });
    expect(r).toEqual({ ok: false, reason: 'ORIGIN_MISMATCH' });
  });

  it('rejects a PATCH with no Origin header', () => {
    const r = checkCsrf({ ...base, method: 'PATCH', origin: undefined, csrfHeader: base.sessionCsrfToken });
    expect(r).toEqual({ ok: false, reason: 'ORIGIN_MISSING' });
  });

  it('rejects a DELETE with a wrong token', () => {
    const r = checkCsrf({ ...base, method: 'DELETE', origin: base.expectedOrigin, csrfHeader: 'wrong' });
    expect(r).toEqual({ ok: false, reason: 'TOKEN_MISMATCH' });
  });

  it('rejects a PUT with no token header', () => {
    const r = checkCsrf({ ...base, method: 'PUT', origin: base.expectedOrigin, csrfHeader: undefined });
    expect(r).toEqual({ ok: false, reason: 'TOKEN_MISSING' });
  });

  it('does not require CSRF for GET', () => {
    const r = checkCsrf({ ...base, method: 'GET', origin: undefined, csrfHeader: undefined });
    expect(r.ok).toBe(true);
  });
});
