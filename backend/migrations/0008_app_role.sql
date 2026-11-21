-- 0008: Application role grants (T019)
-- The application role may INSERT and SELECT audit rows only: no UPDATE, no DELETE, no DDL.
-- The role is created by the database administrator, not by this migration; the grant
-- statements below assume it exists under the name tutor_ledger_app.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tutor_ledger_app') THEN
    CREATE ROLE tutor_ledger_app NOLOGIN;
  END IF;
END
$$;

REVOKE ALL ON audit_event FROM tutor_ledger_app;
GRANT SELECT, INSERT ON audit_event TO tutor_ledger_app;
GRANT USAGE, SELECT ON SEQUENCE audit_event_id_seq TO tutor_ledger_app;

-- Operational tables: no DDL rights; DML only.
REVOKE CREATE ON SCHEMA public FROM tutor_ledger_app;
REVOKE ALL ON ledger, owner_account, session, family, invoice, payment,
  recurring_bill, one_off_expense, scenario, reminder_draft, alert FROM tutor_ledger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ledger, owner_account, session, family, invoice,
  recurring_bill, one_off_expense, scenario, reminder_draft, alert TO tutor_ledger_app;
-- payment is append-only for the application role: no UPDATE, no DELETE
-- (family cascade deletion runs as the owner role through the FK ON DELETE CASCADE).
GRANT SELECT, INSERT ON payment TO tutor_ledger_app;
