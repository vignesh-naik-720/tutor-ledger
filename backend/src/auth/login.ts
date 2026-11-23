import { query } from '../db/client.js';
import { verifyPassword } from './password.js';

// Login and lockout (T021). Lock after 5 consecutive failures for 15 minutes.

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export type LoginOutcome =
  | { status: 'ok' }
  | { status: 'locked'; retryAfterSeconds: number }
  | { status: 'invalid' };

/** Pure transition for the failure counter (tested without a database). */
export function nextFailureState(
  failedCount: number,
  now: Date,
): { failed_login_count: number; locked_until: Date | null } {
  const next = failedCount + 1;
  if (next >= MAX_FAILED_LOGINS) {
    return {
      failed_login_count: 0,
      locked_until: new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000),
    };
  }
  return { failed_login_count: next, locked_until: null };
}

interface OwnerRow {
  ledger_id: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
}

export async function attemptLogin(
  password: string,
  pepper: string,
  now = new Date(),
): Promise<{ outcome: LoginOutcome; ledgerId?: string }> {
  // Single owner per installation (FR-003): the one owner row is the login target.
  const rows = await query<OwnerRow>(
    'SELECT ledger_id, password_hash, failed_login_count, locked_until FROM owner_account LIMIT 1',
  );
  const owner = rows[0];
  if (!owner) return { outcome: { status: 'invalid' } };

  if (owner.locked_until && owner.locked_until.getTime() > now.getTime()) {
    const retryAfterSeconds = Math.ceil((owner.locked_until.getTime() - now.getTime()) / 1000);
    return { outcome: { status: 'locked', retryAfterSeconds } };
  }

  const ok = await verifyPassword(owner.password_hash, password, pepper);
  if (ok) {
    await query(
      'UPDATE owner_account SET failed_login_count = 0, locked_until = NULL, last_reauth_at = $2 WHERE ledger_id = $1',
      [owner.ledger_id, now],
    );
    return { outcome: { status: 'ok' }, ledgerId: owner.ledger_id };
  }

  const next = nextFailureState(owner.failed_login_count, now);
  await query(
    'UPDATE owner_account SET failed_login_count = $2, locked_until = $3 WHERE ledger_id = $1',
    [owner.ledger_id, next.failed_login_count, next.locked_until],
  );
  if (next.locked_until) {
    return {
      outcome: { status: 'locked', retryAfterSeconds: LOCKOUT_MINUTES * 60 },
    };
  }
  return { outcome: { status: 'invalid' } };
}
