import type { QueryResultRow } from 'pg';
import type { ZodTypeAny, z } from 'zod';
import { query } from '../db/client.js';
import type { ErrorCode } from './errorHandler.js';
import { validateBody, type FieldIssue } from './validate.js';

// Shared helpers for /api/v1 route modules: error type, body parsing, ledger lookup and the
// secret-derived dependencies passed in from app.ts. No secret values are defined here.

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly fields: FieldIssue[];

  constructor(statusCode: number, code: ErrorCode, fields: FieldIssue[] = []) {
    super(code);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

export interface ApiDeps {
  fieldKey: Buffer; // AES-256 key for [ENC] fields (TL_FIELD_ENCRYPTION_KEK)
  phoneHmacKey: string; // TL_PHONE_HMAC_KEY
  auditHmacKey: string; // TL_AUDIT_HMAC_KEY
  pepper: string; // TL_SESSION_PEPPER (used by the session guard)
}

declare module 'fastify' {
  interface FastifyRequest {
    ledgerId: string;
  }
}

export function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = validateBody(schema, value);
  if (!result.ok) {
    throw new ApiError(400, 'VALIDATION_FAILED', result.fields);
  }
  return result.data;
}

/** Path parameters: an invalid ID is reported as NOT_FOUND so existence is not revealed. */
export function parseId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(404, 'NOT_FOUND');
  }
  return value;
}

export interface LedgerInfo extends QueryResultRow {
  currency_code: string | null;
  currency_exponent: number | null;
  owner_timezone: string | null;
}

export async function loadLedger(ledgerId: string): Promise<LedgerInfo> {
  const rows = await query<LedgerInfo>(
    'SELECT currency_code, currency_exponent, owner_timezone FROM ledger WHERE id = $1',
    [ledgerId],
  );
  const row = rows[0];
  if (!row) throw new ApiError(404, 'NOT_FOUND');
  return row;
}
