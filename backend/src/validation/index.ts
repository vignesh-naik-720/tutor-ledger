import { z, type ZodTypeAny } from 'zod';

// Boundary validation layer (T028). Strict objects reject unknown fields; strings are trimmed,
// capped and free of control characters; dates are YYYY-MM-DD; IDs are UUID (contracts/api.md).

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export const uuidSchema = z.string().uuid();

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'invalid date');

export const moneyMinorSchema = z.number().int().safe();

export function safeText(min: number, max: number): ZodTypeAny {
  return z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length >= min && s.length <= max, 'length')
    .refine((s) => !CONTROL_CHARS.test(s), 'control');
}

export const passwordSchema = z.string().min(12).max(128);

export const loginBodySchema = z.object({ password: passwordSchema }).strict();

export const clientEventIdSchema = uuidSchema;

export { z };
