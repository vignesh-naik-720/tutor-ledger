-- 0007: Audit Event with HMAC hash chain (T017)

CREATE TABLE audit_event (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- monotonic order
  ledger_id    UUID NOT NULL,                                     -- plain UUID, no FK: survives deletion
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor        TEXT NOT NULL CHECK (actor IN ('owner', 'system', 'anonymous')),
  action_code  TEXT NOT NULL CHECK (char_length(action_code) BETWEEN 1 AND 64),
  subject_type TEXT NOT NULL CHECK (subject_type IN (
                 'family', 'invoice', 'payment', 'bill', 'expense', 'scenario', 'ledger', 'session')),
  subject_id   UUID NULL,                                          -- no foreign key
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,                -- counts and IDs only
  prev_hash    BYTEA NOT NULL,
  row_hash     BYTEA NOT NULL,
  -- Schema forbids name and phone keys in detail (FR-007, FR-004).
  CONSTRAINT audit_detail_no_personal_keys CHECK (
    NOT (detail ? 'name' OR detail ? 'phone' OR detail ? 'family_name' OR detail ? 'phone_e164'
         OR detail ? 'message' OR detail ? 'text'))
);

CREATE INDEX audit_event_ledger_idx ON audit_event (ledger_id, id);
