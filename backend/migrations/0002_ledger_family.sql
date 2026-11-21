-- 0002: Ledger and Family (T012)

CREATE TABLE ledger (
  id                     UUID PRIMARY KEY,
  currency_code          CHAR(3) NULL,                              -- set during setup (ISO 4217)
  currency_exponent      SMALLINT NULL CHECK (currency_exponent BETWEEN 0 AND 4),
  owner_timezone         TEXT NULL,                                 -- IANA id, validated in domain
  minimum_balance_minor  BIGINT NOT NULL DEFAULT 0 CHECK (minimum_balance_minor >= 0),
  opening_balance_minor  BIGINT NOT NULL DEFAULT 0,                 -- may be negative (overdraft)
  is_sample_data         BOOLEAN NOT NULL DEFAULT FALSE,
  wrapped_dek            BYTEA NULL,                                -- per-ledger key wrapped by KEK
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE owner_account ADD CONSTRAINT owner_account_ledger_fk
  FOREIGN KEY (ledger_id) REFERENCES ledger (id) ON DELETE CASCADE;
ALTER TABLE session ADD CONSTRAINT session_ledger_fk
  FOREIGN KEY (ledger_id) REFERENCES ledger (id) ON DELETE CASCADE;

CREATE TABLE family (
  id                  UUID PRIMARY KEY,
  ledger_id           UUID NOT NULL REFERENCES ledger (id) ON DELETE CASCADE,
  name_ct             BYTEA NOT NULL,                               -- [ENC] 1-100 chars, trimmed
  phone_ct            BYTEA NOT NULL,                               -- [ENC] E.164
  phone_digits_hash   BYTEA NOT NULL,                               -- keyed HMAC, duplicate detection only
  default_fee_minor   BIGINT NOT NULL DEFAULT 0 CHECK (default_fee_minor >= 0),
  default_term_days   SMALLINT NOT NULL DEFAULT 0 CHECK (default_term_days BETWEEN 0 AND 365),
  default_tone        TEXT NOT NULL DEFAULT 'neutral' CHECK (default_tone IN ('friendly', 'neutral', 'firm')),
  avg_delay_days      NUMERIC(6,2) NULL,                            -- NULL when no history
  payment_count       INTEGER NOT NULL DEFAULT 0 CHECK (payment_count >= 0),
  is_sample_data      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX family_ledger_idx ON family (ledger_id);
CREATE INDEX family_phone_hash_idx ON family (ledger_id, phone_digits_hash);
