import { describe, expect, it } from 'vitest';
import { assertSameLedger, NotFoundError, scopeFromSession } from '../../src/http/ledgerScope.js';

// S-3: cross-ledger access is denied and existence is not revealed (constitution V).
describe('S-3 cross-ledger denial', () => {
  const ledgerA = '11111111-1111-4111-8111-111111111111';
  const ledgerB = '22222222-2222-4222-8222-222222222222';

  it('allows a record in the session ledger', () => {
    const ctx = scopeFromSession(ledgerA);
    expect(() => assertSameLedger(ctx, ledgerA)).not.toThrow();
  });

  it('returns NOT_FOUND for a record in another ledger', () => {
    const ctx = scopeFromSession(ledgerA);
    expect(() => assertSameLedger(ctx, ledgerB)).toThrow(NotFoundError);
  });

  it('fails closed when the session has no ledger', () => {
    expect(() => scopeFromSession(undefined)).toThrow();
  });
});
