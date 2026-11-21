-- 0001: Owner Account and Session (T011)
-- Foreign keys to ledger are added in 0002 once the ledger table exists.

CREATE TABLE owner_account (
  id                   UUID PRIMARY KEY,
  ledger_id            UUID NOT NULL UNIQUE,                       -- one owner per ledger (FR-003)
  password_hash        TEXT NOT NULL,                              -- argon2id encoded string
  failed_login_count   SMALLINT NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until         TIMESTAMPTZ NULL,                           -- now + 15 min after 5 failures
  session_idle_minutes SMALLINT NOT NULL DEFAULT 15 CHECK (session_idle_minutes = 15),
  last_reauth_at       TIMESTAMPTZ NULL,                           -- 5-minute reauth window
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_password_length CHECK (char_length(password_hash) > 0)
);

CREATE TABLE session (
  id_hash              BYTEA PRIMARY KEY,                          -- peppered SHA-256 of session id
  ledger_id            UUID NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),         -- idle expiry (15 min)
  absolute_expires_at  TIMESTAMPTZ NOT NULL,                       -- created_at + 12 h
  csrf_secret_hash     BYTEA NOT NULL
);

CREATE INDEX session_ledger_idx ON session (ledger_id);
