// Log redaction (T030). Family names, phone numbers, message text and secrets must never reach logs.

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = new Set([
  'name',
  'family_name',
  'familyname',
  'phone',
  'phone_e164',
  'phonenumber',
  'password',
  'token',
  'x-csrf-token',
  'cookie',
  'authorization',
  'message',
  'text',
  'draft_text',
  'session',
  'secret',
  'wrapped_dek',
]);

const PHONE_LIKE = /\+\d{6,15}/g;

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(PHONE_LIKE, REDACTED);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : redactValue(v);
    }
    return out;
  }
  return value;
}

/** Pino `redact` paths: applied by the logger before output. */
export const PINO_REDACT_PATHS: string[] = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'req.body',
  'res.headers["set-cookie"]',
  '*.name',
  '*.phone',
  '*.password',
  '*.message',
  '*.text',
];
