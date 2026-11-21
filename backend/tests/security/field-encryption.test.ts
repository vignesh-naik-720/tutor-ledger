import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptField, encryptField } from '../../src/security/fieldCrypto.js';
import { normalisePhone } from '../../src/validation/phone.js';

// S-7: personal fields are encrypted at rest with AES-256-GCM and bound to row and field (constitution V).
describe('S-7 field encryption', () => {
  const key = randomBytes(32);
  const rowId = '33333333-3333-4333-8333-333333333333';

  it('does not store plaintext', () => {
    const blob = encryptField(key, 'Asha Rao', rowId, 'name_ct');
    expect(blob.toString('utf8')).not.toContain('Asha');
  });

  it('round-trips the value', () => {
    const blob = encryptField(key, 'Asha Rao', rowId, 'name_ct');
    expect(decryptField(key, blob, rowId, 'name_ct')).toBe('Asha Rao');
  });

  it('rejects a ciphertext moved to another field', () => {
    const blob = encryptField(key, '+6591234567', rowId, 'phone_ct');
    expect(() => decryptField(key, blob, rowId, 'name_ct')).toThrow();
  });

  it('rejects a tampered ciphertext', () => {
    const blob = encryptField(key, 'Asha Rao', rowId, 'name_ct');
    blob[blob.length - 20] ^= 0xff;
    expect(() => decryptField(key, blob, rowId, 'name_ct')).toThrow();
  });
});

describe('phone E.164 validation', () => {
  it('normalises separators and accepts E.164', () => {
    expect(normalisePhone(' +65 9123-4567 ')).toBe('+6591234567');
  });

  it('rejects numbers without a country code', () => {
    expect(normalisePhone('91234567')).toBeNull();
  });
});
