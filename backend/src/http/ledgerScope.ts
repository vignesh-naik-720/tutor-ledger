// Server-side ledger scoping (T027). The ledger is always resolved from the server-side session.
// A record that belongs to another ledger is reported as NOT_FOUND so existence is not revealed (FR-003).

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
  }
}

export interface ScopedContext {
  readonly ledgerId: string;
}

export function scopeFromSession(sessionLedgerId: string | undefined): ScopedContext {
  if (!sessionLedgerId) {
    throw new Error('No ledger in session');
  }
  return { ledgerId: sessionLedgerId };
}

/** Throws NotFoundError unless the record's ledger matches the session ledger. */
export function assertSameLedger(ctx: ScopedContext, recordLedgerId: string): void {
  if (ctx.ledgerId !== recordLedgerId) {
    throw new NotFoundError();
  }
}

/** Builds a WHERE clause fragment. Values are always passed as parameters. */
export function ledgerWhere(ctx: ScopedContext, paramIndex: number): { clause: string; params: string[] } {
  return { clause: `ledger_id = $${paramIndex}`, params: [ctx.ledgerId] };
}
