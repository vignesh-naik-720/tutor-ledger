import { createHmac } from 'node:crypto';
import { query } from '../db/client.js';

// Audit writer with HMAC hash chain (T029). Detail holds counts and IDs only. The schema
// (migration 0007) also forbids name and phone keys; this function checks first so the
// write fails with a clear error instead of a database error.

export const ACTORS = ['owner', 'system', 'anonymous'] as const;
export type Actor = (typeof ACTORS)[number];

export const SUBJECT_TYPES = [
  'family',
  'invoice',
  'payment',
  'bill',
  'expense',
  'scenario',
  'ledger',
  'session',
] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

const FORBIDDEN_DETAIL_KEYS = new Set([
  'name',
  'phone',
  'family_name',
  'phone_e164',
  'message',
  'text',
]);

export interface AuditEventInput {
  ledgerId: string;
  actor: Actor;
  actionCode: string;
  subjectType: SubjectType;
  subjectId?: string | null;
  detail?: Record<string, number | string | boolean | null>;
}

export function assertDetailIsSafe(detail: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(detail)) {
    if (FORBIDDEN_DETAIL_KEYS.has(key.toLowerCase())) {
      throw new Error(`Audit detail key not allowed: ${key}`);
    }
    if (typeof value === 'string' && value.length > 64) {
      // Detail is for counts and IDs; long strings suggest free text.
      throw new Error(`Audit detail value too long for key: ${key}`);
    }
  }
}

/** Canonical serialisation: sorted keys so the same row always hashes the same way. */
export function canonicalRow(input: {
  ledgerId: string;
  occurredAt: string;
  actor: string;
  actionCode: string;
  subjectType: string;
  subjectId: string | null;
  detail: Record<string, unknown>;
}): string {
  const sortedDetail = Object.keys(input.detail)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = input.detail[k];
      return acc;
    }, {});
  return JSON.stringify({
    ledger_id: input.ledgerId,
    occurred_at: input.occurredAt,
    actor: input.actor,
    action_code: input.actionCode,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    detail: sortedDetail,
  });
}

export function computeRowHash(key: string, prevHash: Buffer, canonical: string): Buffer {
  return createHmac('sha256', key).update(prevHash).update(canonical).digest();
}

export async function writeAuditEvent(
  input: AuditEventInput,
  hmacKey: string,
  now = new Date(),
): Promise<void> {
  const detail = input.detail ?? {};
  assertDetailIsSafe(detail);
  const subjectId = input.subjectId ?? null;
  const occurredAt = now.toISOString();

  const prior = await query<{ row_hash: Buffer }>(
    'SELECT row_hash FROM audit_event WHERE ledger_id = $1 ORDER BY id DESC LIMIT 1',
    [input.ledgerId],
  );
  const prevHash = prior[0]?.row_hash ?? Buffer.alloc(32, 0);
  const canonical = canonicalRow({
    ledgerId: input.ledgerId,
    occurredAt,
    actor: input.actor,
    actionCode: input.actionCode,
    subjectType: input.subjectType,
    subjectId,
    detail,
  });
  const rowHash = computeRowHash(hmacKey, prevHash, canonical);

  await query(
    `INSERT INTO audit_event
       (ledger_id, occurred_at, actor, action_code, subject_type, subject_id, detail, prev_hash, row_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.ledgerId,
      occurredAt,
      input.actor,
      input.actionCode,
      input.subjectType,
      subjectId,
      JSON.stringify(detail),
      prevHash,
      rowHash,
    ],
  );
}
