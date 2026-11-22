-- 0009: Add name, email, and dob to owner_account for standard user signup and signin
ALTER TABLE owner_account ADD COLUMN IF NOT EXISTS name TEXT NULL;
ALTER TABLE owner_account ADD COLUMN IF NOT EXISTS email TEXT NULL;
ALTER TABLE owner_account ADD COLUMN IF NOT EXISTS dob DATE NULL;

CREATE UNIQUE INDEX IF NOT EXISTS owner_account_email_idx ON owner_account (LOWER(email)) WHERE email IS NOT NULL;
