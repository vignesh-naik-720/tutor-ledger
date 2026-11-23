-- 0006: Alert (T016)

CREATE TABLE alert (
  id                   UUID PRIMARY KEY,
  ledger_id            UUID NOT NULL REFERENCES ledger (id) ON DELETE CASCADE,
  rule                 TEXT NOT NULL CHECK (rule IN ('CASH_BELOW_MINIMUM', 'INVOICE_OVERDUE')),
  severity             SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 10),
  raised_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  iso_week             TEXT NOT NULL,                              -- e.g. 2026-W47 in owner timezone
  linked_record_type   TEXT NOT NULL CHECK (linked_record_type IN ('invoice', 'family', 'scenario', 'ledger')),
  linked_record_id     UUID NOT NULL,                              -- ID only; no names or phones
  action               TEXT NOT NULL CHECK (action IN ('OPEN_REMINDER', 'OPEN_SCENARIO', 'OPEN_CHASE_TODAY')),
  dismissed_at         TIMESTAMPTZ NULL
);

CREATE INDEX alert_ledger_week_idx ON alert (ledger_id, iso_week);
