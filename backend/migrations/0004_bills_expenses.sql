-- 0004: Recurring Bill and One-off Expense (T014)

CREATE TABLE recurring_bill (
  id              UUID PRIMARY KEY,
  ledger_id       UUID NOT NULL REFERENCES ledger (id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  amount_minor    BIGINT NOT NULL CHECK (amount_minor >= 0),
  frequency       TEXT NOT NULL CHECK (frequency IN ('monthly')),
  next_due_date   DATE NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX recurring_bill_ledger_idx ON recurring_bill (ledger_id);

CREATE TABLE one_off_expense (
  id              UUID PRIMARY KEY,
  ledger_id       UUID NOT NULL REFERENCES ledger (id) ON DELETE CASCADE,
  description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 140),
  amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
  expense_date    DATE NOT NULL
);

CREATE INDEX one_off_expense_ledger_idx ON one_off_expense (ledger_id);
