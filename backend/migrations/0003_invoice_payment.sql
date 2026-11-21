-- 0003: Invoice and Payment (T013)

CREATE TABLE invoice (
  id              UUID PRIMARY KEY,
  ledger_id       UUID NOT NULL REFERENCES ledger (id) ON DELETE CASCADE,
  family_id       UUID NOT NULL REFERENCES family (id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  amount_minor    BIGINT NOT NULL,
  issue_date      DATE NOT NULL,
  due_date        DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN (
                    'draft', 'due-awaiting-confirmation', 'open', 'partially-paid', 'paid', 'void')),
  version         INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),   -- optimistic concurrency
  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoice_period_order CHECK (period_end >= period_start),
  CONSTRAINT invoice_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT invoice_due_order CHECK (due_date >= issue_date),
  CONSTRAINT invoice_unique_period UNIQUE (ledger_id, family_id, period_start)
);

CREATE TABLE payment (
  id                       UUID PRIMARY KEY,
  ledger_id                UUID NOT NULL REFERENCES ledger (id) ON DELETE CASCADE,
  family_id                UUID NOT NULL REFERENCES family (id) ON DELETE CASCADE,
  invoice_id               UUID NOT NULL REFERENCES invoice (id) ON DELETE CASCADE,
  client_event_id          UUID NOT NULL,                           -- idempotency key
  amount_minor             BIGINT NOT NULL CHECK (amount_minor > 0),
  date_received            DATE NOT NULL,
  source                   TEXT NOT NULL CHECK (source IN ('owner_entry', 'confirmed_pasted_message')),
  was_offline              BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  pasted_amount_flagged    BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample_data           BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT payment_idempotency UNIQUE (ledger_id, client_event_id)
);

CREATE INDEX payment_invoice_idx ON payment (invoice_id);

-- Payments are append-only: the application role has no UPDATE on this table (see 0008).
