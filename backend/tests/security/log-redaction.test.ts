import { describe, expect, it } from 'vitest';
import { REDACTED, redactValue } from '../../src/logging/redact.js';

// S-6: logs never contain family names, phone numbers, passwords or message text (constitution V).
describe('S-6 log redaction', () => {
  it('redacts personal keys in nested objects', () => {
    const out = redactValue({
      name: 'Asha Rao',
      phone: '+6591234567',
      nested: { family_name: 'Rao', password: 'correct horse battery' },
      count: 3,
    }) as Record<string, unknown>;
    expect(out['name']).toBe(REDACTED);
    expect(out['phone']).toBe(REDACTED);
    expect((out['nested'] as Record<string, unknown>)['family_name']).toBe(REDACTED);
    expect((out['nested'] as Record<string, unknown>)['password']).toBe(REDACTED);
    expect(out['count']).toBe(3);
  });

  it('removes phone-like values inside free strings', () => {
    const out = redactValue('call +6591234567 now');
    expect(out).toBe(`call ${REDACTED} now`);
  });

  it('redacts pasted message text', () => {
    const out = redactValue({ message: 'Paid $200 for Asha' }) as Record<string, unknown>;
    expect(out['message']).toBe(REDACTED);
  });
});
