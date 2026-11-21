import { describe, expect, it } from 'vitest';
import { MAX_FAILED_LOGINS, LOCKOUT_MINUTES, nextFailureState } from '../../src/auth/login.js';

// S-1: login lockout after 5 failures for 15 minutes (constitution V).
describe('S-1 login lockout', () => {
  const now = new Date('2026-11-21T10:00:00Z');

  it('does not lock before the fifth failure', () => {
    let state = { failed_login_count: 0, locked_until: null as Date | null };
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) {
      state = nextFailureState(state.failed_login_count, now);
      expect(state.locked_until).toBeNull();
    }
    expect(state.failed_login_count).toBe(MAX_FAILED_LOGINS - 1);
  });

  it('locks for 15 minutes on the fifth failure', () => {
    const state = nextFailureState(MAX_FAILED_LOGINS - 1, now);
    expect(state.locked_until).not.toBeNull();
    expect(state.locked_until!.getTime() - now.getTime()).toBe(LOCKOUT_MINUTES * 60 * 1000);
  });
});
