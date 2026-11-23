import argon2 from 'argon2';
import { createHmac } from 'node:crypto';

// Password hashing (argon2id). The pepper is applied via HMAC before hashing so that the
// stored hash is useless without the secret store value.

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export function isValidPasswordLength(password: string): boolean {
  const n = [...password].length;
  return n >= PASSWORD_MIN && n <= PASSWORD_MAX;
}

function pepperInput(password: string, pepper: string): string {
  return createHmac('sha256', pepper).update(password).digest('base64');
}

export async function hashPassword(password: string, pepper: string): Promise<string> {
  if (!isValidPasswordLength(password)) {
    throw new Error('Password length out of range');
  }
  return argon2.hash(pepperInput(password, pepper), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(
  hash: string,
  password: string,
  pepper: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, pepperInput(password, pepper));
  } catch {
    return false;
  }
}
