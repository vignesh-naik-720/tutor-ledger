import { describe, expect, it } from 'vitest';
import { IDLE_TIMEOUT_MS, isSessionExpired } from '../../src/auth/session.js';

// S-2: idle timeout at 15 minutes via last_seen_at (constitution V).
describe('S-2 session idle timeout', () => {
  const lastSeen = new Date('2026-11-21T10:00:00Z');
  const absolute = new Date(lastSeen.getTime() + 12 * 60 * 60 * 1000);

  it('is ok within 15 minutes of last activity', () => {
    const now = new Date(lastSeen.getTime() + IDLE_TIMEOUT_MS - 1000);
    expect(isSessionExpired(now, lastSeen, absolute)).toBe('ok');
  });

  it('expires after 15 minutes of inactivity', () => {
    const now = new Date(lastSeen.getTime() + IDLE_TIMEOUT_MS + 1000);
    expect(isSessionExpired(now, lastSeen, absolute)).toBe('idle');
  });

  it('expires at the 12-hour absolute lifetime even when active', () => {
    const now = new Date(absolute.getTime());
    expect(isSessionExpired(now, now, absolute)).toBe('absolute');
  });
});
