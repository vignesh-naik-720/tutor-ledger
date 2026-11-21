import { randomUUID } from 'node:crypto';
import { redactValue } from '../logging/redact.js';

// Error handler (T030). Returns the fixed error envelope from contracts/api.md. Messages come
// from a fixed catalogue; submitted values and stack traces never reach the client.

export const ERROR_MESSAGES = {
  VALIDATION_FAILED: 'The request was not valid.',
  UNAUTHENTICATED: 'Sign in required.',
  SESSION_EXPIRED: 'Your session has ended. Sign in again.',
  FORBIDDEN: 'Not allowed.',
  NOT_FOUND: 'Not found.',
  CSRF_FAILED: 'The request could not be verified.',
  REAUTH_REQUIRED: 'Re-enter your password to continue.',
  RATE_LIMITED: 'Too many requests. Try again shortly.',
  CONFLICT: 'This conflicts with the current record state.',
  LOCKED_OUT: 'Sign-in is temporarily unavailable.',
  PAYMENT_FLAGGED: 'This payment needs review before it can be saved.',
  INTERNAL: 'Something went wrong.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    request_id: string;
    fields: { path: string; rule: string }[];
  };
}

export function buildErrorEnvelope(
  code: ErrorCode,
  fields: { path: string; rule: string }[] = [],
  requestId: string = randomUUID(),
): ErrorEnvelope {
  return {
    error: {
      code,
      message: ERROR_MESSAGES[code],
      request_id: requestId,
      fields: fields.map((f) => ({ path: f.path, rule: f.rule })),
    },
  };
}

/** Logs an internal error with redaction. Names and stack traces are reduced to type + id. */
export function describeInternalError(err: unknown): Record<string, unknown> {
  const name = err instanceof Error ? err.name : 'UnknownError';
  return redactValue({ err_type: name, request_id: randomUUID() }) as Record<string, unknown>;
}
