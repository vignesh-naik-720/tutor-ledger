import { query } from '../db/client.js';

// Reauth guard (T022). Sensitive actions require last_reauth_at within the last 5 minutes.

export const REAUTH_WINDOW_MS = 5 * 60 * 1000;

export function isReauthFresh(lastReauthAt: Date | null, now = new Date()): boolean {
  if (!lastReauthAt) return false;
  const age = now.getTime() - lastReauthAt.getTime();
  return age >= 0 && age <= REAUTH_WINDOW_MS;
}

export async function requireReauth(ledgerId: string, now = new Date()): Promise<boolean> {
  const rows = await query<{ last_reauth_at: Date | null }>(
    'SELECT last_reauth_at FROM owner_account WHERE ledger_id = $1',
    [ledgerId],
  );
  return isReauthFresh(rows[0]?.last_reauth_at ?? null, now);
}
