import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Field encryption (T026): AES-256-GCM via Node crypto (vetted primitive; no custom crypto).
// Stored layout: nonce(12) || ciphertext || tag(16). AAD binds the ciphertext to the row ID
// and field name so values cannot be swapped between rows or columns (research R-8).

const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export function encryptField(key: Buffer, plaintext: string, rowId: string, fieldName: string): Buffer {
  if (key.length !== KEY_BYTES) throw new Error('Invalid key length');
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(`${rowId}|${fieldName}`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]);
}

export function decryptField(key: Buffer, blob: Buffer, rowId: string, fieldName: string): string {
  if (key.length !== KEY_BYTES) throw new Error('Invalid key length');
  if (blob.length < NONCE_BYTES + TAG_BYTES) throw new Error('Ciphertext too short');
  const nonce = blob.subarray(0, NONCE_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const ciphertext = blob.subarray(NONCE_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(`${rowId}|${fieldName}`, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
