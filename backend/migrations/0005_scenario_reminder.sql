-- 0005: Scenario and Reminder Draft (T015)

CREATE TABLE scenario (
  id          UUID PRIMARY KEY,
  ledger_id   UUID NOT NULL REFERENCES ledger (id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  type        TEXT NOT NULL CHECK (type IN (
                'builtin_late_payment', 'builtin_family_leaves', 'builtin_new_family',
                'builtin_bill_rise', 'combination', 'custom')),
  parameters  JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- validated by zod per type
  is_on       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX scenario_ledger_idx ON scenario (ledger_id);

CREATE TABLE reminder_draft (
  id                 UUID PRIMARY KEY,
  ledger_id          UUID NOT NULL REFERENCES ledger (id) ON DELETE CASCADE,
  family_id          UUID NOT NULL REFERENCES family (id) ON DELETE CASCADE,
  invoice_id         UUID NOT NULL REFERENCES invoice (id) ON DELETE CASCADE,
  tone               TEXT NOT NULL CHECK (tone IN ('friendly', 'neutral', 'firm')),
  text_ct            BYTEA NOT NULL,                              -- [ENC] <= 500 chars before encryption
  drafted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  out_of_date        BOOLEAN NOT NULL DEFAULT FALSE,
  send_confirmed_at  TIMESTAMPTZ NULL                             -- owner confirmed wa.me open only
);

CREATE INDEX reminder_draft_ledger_idx ON reminder_draft (ledger_id);
