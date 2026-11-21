# Tasks: Tutor Ledger

**Feature**: 001-tutor-ledger
**Inputs**: spec.md, plan.md, data-model.md, contracts/, quickstart.md

This list turns the approved design into ordered, executable work. Phase 1 and Phase 2 must finish before any user story starts. Phases 3–8 follow the priority order in spec.md, with US1 (Record, chase, recover payments) as the MVP. Polish runs last.

**Stack (proposed, to confirm)**: TypeScript SPA (React + Vite, installable PWA, no `dangerouslySetInnerHTML`); TypeScript Node LTS API (Fastify, zod validation); PostgreSQL 16 (parameterized queries only); IndexedDB offline queue encrypted with a non-extractable WebCrypto key.

**Folders**: `frontend/`, `backend/`, `shared/forecast/` (pure, no I/O; not `packages/forecast`), `e2e/` (end-to-end tests).

**Constitution V**: security-control tests marked "(required by constitution V)" are mandatory and cannot be skipped.

## Format: `[ID] [P?] [Story] Description`

- **ID**: Sequential task number (T001, T002, ...) in file order.
- **[P]**: Different file from the other tasks in its group and safe to run in parallel with other [P] tasks in the same phase once the non-[P] tasks above it are done.
- **[Story]**: User story label (US1–US6). Used only in Phases 3–8.
- Every description names the exact file path. Constrained fields cite `data-model.md Entity.field`.

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure per plan.md

- [X] T001 Create the project layout folders `frontend/`, `backend/`, `shared/forecast/`, and `e2e/` at the repository root, each with a placeholder `README.md`
- [X] T002 [P] Initialize the TypeScript SPA with React and Vite, installable PWA plugin, and `frontend/package.json` plus `frontend/vite.config.ts`
- [X] T003 [P] Initialize the TypeScript Node LTS API with Fastify and zod in `backend/package.json` and `backend/tsconfig.json`
- [X] T004 [P] Initialize the pure TypeScript forecast module in `shared/forecast/package.json` and `shared/forecast/tsconfig.json` with no I/O imports allowed
- [X] T005 [P] Initialize the end-to-end test project in `e2e/package.json` with runner config in `e2e/test.config.ts`
- [ ] T006 Pin lockfiles for `frontend/`, `backend/`, `shared/forecast/`, and `e2e/` (commit `package-lock.json` in each folder)
- [X] T007 [P] Configure shared lint and formatting in `.eslintrc.cjs` and `.prettierrc` at the repository root
- [X] T008 Add a CI dependency vulnerability scan step in `.github/workflows/ci.yml` that fails the build on high or critical advisories
- [X] T009 Configure secret-store access in `backend/src/config/secrets.ts` for the runtime keys (session pepper, audit HMAC key, field encryption key); keep no secret values in the repo and list only key names in `backend/.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure and security controls (FR-001..010: access, privacy, security, audit). MUST complete before ANY user story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T010 Create the PostgreSQL 16 migration runner in `backend/src/db/migrate.ts` with migrations in `backend/migrations/` and a parameterized-query helper in `backend/src/db/client.ts`
- [X] T011 [P] Create the Owner Account and Session schema in `backend/migrations/0001_owner_session.sql` with Owner Account.password (12–128 chars, stored as argon2id hash), Owner Account.failed_login_count (lock at 5), Owner Account.locked_until (now + 15 min), Owner Account.session_idle_minutes (fixed 15), Owner Account.last_reauth_at (5-minute window), Session.last_seen_at (idle expiry), and Session.absolute_expires_at (+12 h) (data-model.md Owner Account.password, Owner Account.failed_login_count, Owner Account.locked_until, Owner Account.session_idle_minutes, Owner Account.last_reauth_at, Session.last_seen_at, Session.absolute_expires_at)
- [X] T012 [P] Create the Ledger and Family schema in `backend/migrations/0002_ledger_family.sql` with Ledger.currency_code, Ledger.currency_exponent, Ledger.owner_timezone (IANA), Ledger.minimum_balance_minor (>= 0), Family.name_ct (ENC, 1–100 chars), Family.phone_ct (ENC, E.164), Family.default_fee_minor (>= 0), Family.default_term_days (0–365), Family.default_tone (friendly|neutral|firm), Family.avg_delay_days (NULL when no history), and Family.payment_count (data-model.md Ledger.currency_code, Ledger.currency_exponent, Ledger.owner_timezone, Ledger.minimum_balance_minor, Family.name_ct, Family.phone_ct, Family.default_fee_minor, Family.default_term_days, Family.default_tone, Family.avg_delay_days, Family.payment_count)
- [X] T013 [P] Create the Invoice and Payment schema in `backend/migrations/0003_invoice_payment.sql` with Invoice.period_end (>= period_start), Invoice.amount_minor (> 0), Invoice.due_date (>= issue_date), Invoice.status enum (draft, due-awaiting-confirmation, open, partially-paid, paid, void), Invoice.version (optimistic concurrency), unique (ledger_id, family_id, period_start), Payment.amount_minor (> 0), Payment.source (owner_entry|confirmed_pasted_message), and unique (ledger_id, client_event_id); payments are append-only (data-model.md Invoice.period_end, Invoice.amount_minor, Invoice.due_date, Invoice.status, Invoice.version, Invoice.uniqueness, Payment.amount_minor, Payment.source, Payment.uniqueness)
- [X] T014 [P] Create the Recurring Bill and One-off Expense schema in `backend/migrations/0004_bills_expenses.sql` with Recurring Bill.name (1–100), Recurring Bill.amount_minor (>= 0), Recurring Bill.frequency (monthly), One-off Expense.description (1–140), and One-off Expense.amount_minor (> 0) (data-model.md Recurring Bill.name, Recurring Bill.amount_minor, Recurring Bill.frequency, One-off Expense.description, One-off Expense.amount_minor)
- [X] T015 [P] Create the Scenario and Reminder Draft schema in `backend/migrations/0005_scenario_reminder.sql` with Scenario.name (1–80), Scenario.type (builtin_late_payment|builtin_family_leaves|builtin_new_family|builtin_bill_rise|combination|custom), Scenario.parameters (JSON validated by zod per type), Reminder Draft.tone (friendly|neutral|firm), and Reminder Draft.text_ct (<= 500 chars) (data-model.md Scenario.name, Scenario.type, Scenario.parameters, Reminder Draft.tone, Reminder Draft.text_ct)
- [X] T016 [P] Create the Alert schema in `backend/migrations/0006_alert.sql` with Alert.rule (rule codes such as CASH_BELOW_MINIMUM and INVOICE_OVERDUE), Alert.severity, Alert.linked_record_type (invoice|family|scenario|ledger), and Alert.action (exactly one of OPEN_REMINDER|OPEN_SCENARIO|OPEN_CHASE_TODAY) (data-model.md Alert.rule, Alert.severity, Alert.linked_record_type, Alert.action)
- [X] T017 [P] Create the Audit Event schema in `backend/migrations/0007_audit_event.sql` with Audit Event.actor (owner|system|anonymous), Audit Event.subject_id (no foreign key on ledger_id), Audit Event.detail (counts and IDs only), and the hash-chain columns (data-model.md Audit Event.actor, Audit Event.subject_id, Audit Event.detail)
- [X] T018 [P] Define the Offline Queue Item type in `frontend/src/offline/queueItem.ts` with Offline Queue Item.type limited to payment|invoice_confirm (data-model.md Offline Queue Item.type)
- [X] T019 Create the application DB role in `backend/migrations/0008_app_role.sql` granting INSERT and SELECT only on Audit Event with no CREATE rights (data-model.md Audit Event.grants)
- [X] T020 [P] Implement server sessions in `backend/src/auth/session.ts`: cookie `__Host-tl_session` with HttpOnly, Secure, SameSite=Strict; idle expiry at 15 min via Session.last_seen_at; absolute expiry at Session.absolute_expires_at (+12 h); store a SHA-256 peppered hash of the session ID only (data-model.md Session.last_seen_at, Session.absolute_expires_at, Owner Account.session_idle_minutes)
- [X] T021 [P] Implement argon2id password hashing and login in `backend/src/auth/password.ts` and `backend/src/auth/login.ts`: enforce Owner Account.password 12–128 chars; lock after Owner Account.failed_login_count reaches 5 until Owner Account.locked_until (now + 15 min); rate-limit `POST /api/v1/auth/login` (data-model.md Owner Account.password, Owner Account.failed_login_count, Owner Account.locked_until)
- [X] T022 [P] Implement the reauth guard in `backend/src/auth/reauth.ts` that requires Owner Account.last_reauth_at within the 5-minute window before a sensitive action runs (data-model.md Owner Account.last_reauth_at)
- [X] T023 [P] Implement CSRF and Origin checks in `backend/src/security/csrf.ts`: every mutation requires header X-CSRF-Token and a matching Origin; ledger_id is never read from the client
- [X] T024 [P] Implement strict CSP and security headers in `backend/src/security/headers.ts`
- [X] T025 [P] Add a lint rule banning `dangerouslySetInnerHTML` in `frontend/eslint.config.js`
- [X] T026 [P] Implement field encryption in `backend/src/security/fieldCrypto.ts` for Family.name_ct (1–100 chars, trimmed, no control chars) and Family.phone_ct, using keys from the secret store; validate Family.phone_ct as E.164 in `backend/src/validation/phone.ts` before storage (data-model.md Family.name_ct, Family.phone_ct)
- [X] T027 [P] Implement server-side ledger scoping in `backend/src/http/ledgerScope.ts`: resolve the ledger from the session and deny any cross-ledger access
- [X] T028 [P] Implement the zod validation layer in `backend/src/validation/index.ts` with request middleware in `backend/src/http/validate.ts`
- [X] T029 [P] Implement the audit writer with HMAC hash chain in `backend/src/audit/auditWriter.ts`: detail holds counts and IDs only, the schema forbids name and phone keys, and Audit Event.actor is owner|system|anonymous (data-model.md Audit Event.actor, Audit Event.subject_id, Audit Event.detail)
- [X] T030 [P] Implement log and error redaction in `backend/src/logging/redact.ts` and `backend/src/http/errorHandler.ts`
- [X] T031 Write login lockout test in `backend/tests/security/login-lockout.test.ts` covering S-1 (required by constitution V) (data-model.md Owner Account.failed_login_count, Owner Account.locked_until)
- [X] T032 Write idle timeout test in `backend/tests/security/session-idle.test.ts` covering S-2 (required by constitution V) (data-model.md Session.last_seen_at)
- [X] T033 Write cross-ledger denial test in `backend/tests/security/cross-ledger.test.ts` covering S-3 (required by constitution V)
- [X] T034 Write CSRF and Origin rejection test in `backend/tests/security/csrf-origin.test.ts` covering S-10 (required by constitution V)
- [X] T035 Write log redaction test in `backend/tests/security/log-redaction.test.ts` covering S-6 (required by constitution V)
- [X] T036 Write encryption-at-rest test in `backend/tests/security/field-encryption.test.ts` covering S-7 (required by constitution V) (data-model.md Family.name_ct, Family.phone_ct)
- [X] T037 Write audit append-only test in `backend/tests/security/audit-append-only.test.ts` covering S-8 (required by constitution V) (data-model.md Audit Event.grants)
- [X] T038 Write app-role CREATE TABLE denial test in `backend/tests/security/app-role-grants.test.ts` covering S-9 (required by constitution V) (data-model.md Audit Event.grants)

**Checkpoint (Foundational)**: Foundation ready. Security controls S-1, S-2, S-3, S-6, S-7, S-8, S-9, and S-10 pass. User story work can now begin.

---

## Phase 3: User Story 1 - Record, chase, recover payments (Priority: P1) 🎯 MVP

**Goal**: The owner records invoices and payments, chases overdue families from Chase Today, and recovers partial payments with a reminder the owner sends manually (FR-016..027).

**Independent Test**: Create a family and an invoice, record a partial then a full payment, confirm Chase Today ranks the overdue family, and confirm a reminder opens only through the owner's manual send (SC-002, SC-003, SC-008).

### Implementation for User Story 1

- [ ] T039 [US1] Implement family routes in `backend/src/routes/families.ts` (`GET`/`POST`/`PATCH /api/v1/families`) that store Family.default_fee_minor (>= 0), Family.default_term_days (0–365), and Family.default_tone (friendly|neutral|firm) (data-model.md Family.default_fee_minor, Family.default_term_days, Family.default_tone)
- [X] T040 [P] [US1] Implement invoice domain rules in `backend/src/domain/invoice.ts`: Invoice.period_end >= period_start, Invoice.amount_minor > 0, Invoice.due_date >= issue_date, Invoice.status transitions, and Invoice.version checks for optimistic concurrency (data-model.md Invoice.period_end, Invoice.amount_minor, Invoice.due_date, Invoice.status, Invoice.version)
- [X] T041 [P] [US1] Implement repeat invoice generation in `backend/src/domain/invoiceGenerate.ts`: a repeat creates status due-awaiting-confirmation and is blocked by the unique (ledger_id, family_id, period_start) rule (data-model.md Invoice.uniqueness (ledger_id, family_id, period_start), Invoice.status)
- [ ] T042 [US1] Implement invoice routes in `backend/src/routes/invoices.ts`: create, confirm (due-awaiting-confirmation to open), and void; void is blocked once any payment exists (data-model.md Invoice.status, Invoice.version)
- [X] T043 [P] [US1] Implement payment domain rules in `backend/src/domain/payment.ts`: Payment.amount_minor > 0 and <= remaining balance, overpayment rejected, Payment.source (owner_entry|confirmed_pasted_message), append-only storage, and idempotency through unique (ledger_id, client_event_id) (data-model.md Payment.amount_minor, Payment.source, Payment.uniqueness (ledger_id, client_event_id))
- [ ] T044 [US1] Implement payment routes in `backend/src/routes/payments.ts`: `POST /api/v1/payments` for owner entry and `POST /api/v1/payments/parse-message`, which writes nothing, caps input at 2,000 chars, and never stores the raw pasted message
- [X] T045 [P] [US1] Implement the pasted-message parser in `backend/src/domain/messageParser.ts` as a pure function that returns pre-fill candidates for amount and date only
- [X] T046 [P] [US1] Implement Chase Today ranking in `backend/src/domain/chaseToday.ts` with the spec-defined ranking and tie-break; use Family.avg_delay_days (NULL when no history) and treat Family.payment_count < 3 as thin history (data-model.md Family.avg_delay_days, Family.payment_count)
- [ ] T047 [US1] Implement reminder drafts in `backend/src/domain/reminder.ts`: Reminder Draft.tone (friendly|neutral|firm), Reminder Draft.text_ct <= 500 chars, and `POST /api/v1/reminders/{id}/open-link`, which returns a wa.me URL only when owner_confirmed is true; nothing is sent automatically (data-model.md Reminder Draft.tone, Reminder Draft.text_ct)
- [ ] T048 [P] [US1] Implement the Chase Today and Recover views in `frontend/src/features/chase/ChaseToday.tsx` and `frontend/src/features/chase/RecoverPanel.tsx`
- [ ] T049 [P] [US1] Implement the payment entry form with paste-message pre-fill in `frontend/src/features/payments/PaymentForm.tsx`; pre-fill never saves until the owner confirms
- [ ] T050 [P] [US1] Implement the reminder composer in `frontend/src/features/reminders/ReminderComposer.tsx` that opens the wa.me link only after owner_confirmed and requires the owner to press send
- [X] T051 [US1] Write the pasted-message pre-fill test in `backend/tests/payments/parse-message-prefill.test.ts` covering S-4 (required by constitution V)
- [X] T052 [US1] Write the reminder never auto-sent test in `backend/tests/reminders/never-auto-sent.test.ts` covering S-5 (required by constitution V)
- [ ] T053 [US1] Write the Record, chase, recover journey test in `e2e/tests/record-chase-recover.spec.ts`

**Checkpoint**: User Story 1 works end to end and is testable on its own. This is the MVP.

---

## Phase 4: User Story 2 - First-run setup and sample data (Priority: P2)

**Goal**: A new owner completes one-time setup, sets ledger currency and timezone, and can load or remove sample data (FR-011..015).

**Independent Test**: On a fresh install, complete setup with the one-time secret, confirm the ledger settings are saved, load sample data, then remove it after reauth (SC-001).

### Implementation for User Story 2

- [ ] T054 [US2] Implement setup routes in `backend/src/routes/setup.ts`: public `GET /api/v1/setup/status` and `POST /api/v1/setup/owner`, which requires the one-time setup secret and disables itself after first use; Owner Account.password must be 12–128 chars (data-model.md Owner Account.password)
- [ ] T055 [US2] Implement ledger settings in `backend/src/domain/ledgerSettings.ts`: Ledger.currency_code is read-only after the first invoice or payment, Ledger.currency_exponent is set from the currency, Ledger.owner_timezone is a valid IANA zone, and Ledger.minimum_balance_minor >= 0 (data-model.md Ledger.currency_code, Ledger.currency_exponent, Ledger.owner_timezone, Ledger.minimum_balance_minor)
- [ ] T056 [P] [US2] Implement the setup wizard in `frontend/src/features/setup/SetupWizard.tsx`
- [ ] T057 [US2] Implement sample data in `backend/src/domain/sampleData.ts` with `POST /api/v1/setup/sample-data` and `DELETE /api/v1/setup/sample-data`; DELETE requires reauth via Owner Account.last_reauth_at (data-model.md Owner Account.last_reauth_at)
- [ ] T058 [P] [US2] Implement the sample data panel in `frontend/src/features/setup/SampleDataPanel.tsx`
- [ ] T059 [US2] Write the one-time setup test in `backend/tests/setup/setup-one-time.test.ts`
- [ ] T060 [US2] Write the first-run journey test in `e2e/tests/first-run-setup.spec.ts`

**Checkpoint**: User Story 2 works on its own. A new install can be set up and seeded.

---

## Phase 5: User Story 3 - Who owes me (Priority: P3)

**Goal**: The owner sees the families who owe money, with the top five by default and a full list on request (FR-028..030).

**Independent Test**: With several open invoices, the default view shows five families and the "all" view shows every family with a balance.

### Implementation for User Story 3

- [ ] T061 [US3] Implement the who-owes query in `backend/src/domain/whoOwes.ts` over Invoice.status open and partially-paid, sorted by balance
- [ ] T062 [US3] Implement `GET /api/v1/who-owes` in `backend/src/routes/whoOwes.ts` with limit=5 as default and all=true for the full list
- [ ] T063 [P] [US3] Implement the who-owes list in `frontend/src/features/whoOwes/WhoOwesList.tsx` with a "Show all" toggle
- [ ] T064 [US3] Write the who-owes limit and all test in `backend/tests/who-owes/limit-all.test.ts`

**Checkpoint**: User Story 3 works on its own.

---

## Phase 6: User Story 4 - Cash forecast (Priority: P4)

**Goal**: The owner sees a monthly cash forecast built from recurring bills, one-off expenses, and expected receipts, with the minimum-balance line (FR-031..035).

**Independent Test**: With known bills, expenses, and invoices, the forecast in `shared/forecast` matches the expected balances and crosses the minimum-balance line where expected (SC-004).

### Implementation for User Story 4

- [ ] T065 [US4] Implement the pure forecast engine in `shared/forecast/src/forecast.ts` with no I/O; inputs are Recurring Bill.amount_minor (>= 0), Recurring Bill.frequency (monthly), One-off Expense.amount_minor (> 0), Invoice.due_date, Family.avg_delay_days (NULL falls back to term), and Ledger.minimum_balance_minor (data-model.md Recurring Bill.amount_minor, Recurring Bill.frequency, One-off Expense.amount_minor, Ledger.minimum_balance_minor, Family.avg_delay_days)
- [ ] T066 [P] [US4] Implement recurring bill and one-off expense domain CRUD in `backend/src/domain/bills.ts` and `backend/src/domain/expenses.ts`; Recurring Bill.name (1–100) and One-off Expense.description (1–140) are enforced here (data-model.md Recurring Bill.name, One-off Expense.description)
- [ ] T067 [US4] Implement `GET /api/v1/forecast` in `backend/src/routes/forecast.ts`, which calls the pure engine in `shared/forecast/src/forecast.ts`
- [ ] T068 [P] [US4] Implement the forecast chart in `frontend/src/features/forecast/ForecastChart.tsx`
- [ ] T069 [P] [US4] Implement the bills and expenses forms in `frontend/src/features/forecast/BillsAndExpenses.tsx`
- [ ] T070 [US4] Write unit tests for the pure engine in `shared/forecast/tests/forecast.test.ts`

**Checkpoint**: User Story 4 works on its own.

---

## Phase 7: User Story 5 - What-if scenarios (Priority: P5)

**Goal**: The owner builds what-if scenarios (late payment, family leaves, new family, bill rise, combination, custom) and compares them with the base forecast (FR-036..038).

**Independent Test**: A scenario with a late payment and a bill rise changes the forecast as expected, and invalid parameters (expressions, days over 90) are rejected (SC-005).

### Implementation for User Story 5

- [ ] T071 [US5] Implement scenario parameter validation in `backend/src/validation/scenario.ts` with zod per type: Scenario.parameters, days <= 90, percent_bp 0–10000, and no expressions; Scenario.name must be 1–80 chars (data-model.md Scenario.name, Scenario.type, Scenario.parameters)
- [ ] T072 [US5] Implement scenario domain logic in `backend/src/domain/scenario.ts` for the built-ins builtin_late_payment, builtin_family_leaves, builtin_new_family, builtin_bill_rise, combination, and custom (data-model.md Scenario.type)
- [ ] T073 [P] [US5] Implement pure scenario transforms in `shared/forecast/src/scenarios.ts` applied to forecast inputs
- [ ] T074 [US5] Implement scenario routes in `backend/src/routes/scenarios.ts`
- [ ] T075 [P] [US5] Implement the scenario builder in `frontend/src/features/scenarios/ScenarioBuilder.tsx`
- [ ] T076 [US5] Write scenario validation tests in `backend/tests/scenarios/validation.test.ts` and transform tests in `shared/forecast/tests/scenarios.test.ts`

**Checkpoint**: User Story 5 works on its own.

---

## Phase 8: User Story 6 - Alerts with next actions (Priority: P6)

**Goal**: The owner sees alerts such as cash below minimum or invoice overdue, and each alert offers exactly one next action (FR-039..041).

**Independent Test**: When cash falls below the minimum or an invoice goes overdue, an alert appears with one action that opens the matching screen (SC-006).

### Implementation for User Story 6

- [ ] T077 [US6] Implement alert rules in `backend/src/domain/alerts.ts` with rule codes CASH_BELOW_MINIMUM and INVOICE_OVERDUE; each Alert.rule has an Alert.severity, Alert.linked_record_type (invoice|family|scenario|ledger), and exactly one Alert.action (OPEN_REMINDER|OPEN_SCENARIO|OPEN_CHASE_TODAY) (data-model.md Alert.rule, Alert.severity, Alert.linked_record_type, Alert.action)
- [ ] T078 [US6] Implement `GET /api/v1/alerts` in `backend/src/routes/alerts.ts`, returning each alert with its single action
- [ ] T079 [P] [US6] Implement the alerts list in `frontend/src/features/alerts/AlertsList.tsx`, where each action button navigates to its target screen
- [ ] T080 [US6] Write the alert action test in `backend/tests/alerts/alert-actions.test.ts` that asserts exactly one action per alert

**Checkpoint**: User Story 6 works on its own. All stories are complete.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span multiple stories

- [ ] T081 Implement family export and permanent delete with cascade in `backend/src/domain/familyExport.ts` and `backend/src/domain/familyDelete.ts`; `GET /api/v1/export` and `DELETE /api/v1/families/{id}` require reauth via Owner Account.last_reauth_at and write an Audit Event with counts and IDs only (data-model.md Owner Account.last_reauth_at, Audit Event.detail)
- [ ] T082 Write the family export and delete test in `backend/tests/polish/family-export-delete.test.ts` covering S-11 (cascade, audit, and reauth)
- [ ] T083 Implement offline queue sync and clearing in `frontend/src/offline/sync.ts`: replay queued Offline Queue Item.type (payment|invoice_confirm) items, use Payment.uniqueness (ledger_id, client_event_id) to avoid duplicates, and clear each item only after server acknowledgement (data-model.md Offline Queue Item.type, Payment.uniqueness)
- [ ] T084 Write the offline queue sync test in `e2e/tests/offline-queue-sync.spec.ts`
- [ ] T085 Verify SC-007 (cross-cutting measure in spec.md) in `e2e/tests/sc-007-cross-cutting.spec.ts`
- [ ] T086 Run the quickstart manual checks S-A through S-H from `specs/001-tutor-ledger/quickstart.md` and record pass or fail for each in `e2e/reports/quickstart-results.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories.
- **User Stories (Phases 3–8)**: Each depends on Foundational. Run in priority order P1 → P2 → P3 → P4 → P5 → P6. US1 is the MVP.
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1, Phase 3)**: Starts after Foundational. No dependency on other stories.
- **US2 (P2, Phase 4)**: Starts after Foundational. Uses the ledger and invoice work from US1.
- **US3 (P3, Phase 5)**: Starts after US1 (needs invoices and payments).
- **US4 (P4, Phase 6)**: Starts after US1 and US2 (needs ledger settings and receivables).
- **US5 (P5, Phase 7)**: Starts after US4 (scenarios transform the forecast).
- **US6 (P6, Phase 8)**: Starts after US1 and US4 (alerts read invoices and cash).

### Within Each User Story

- Domain rules before routes; routes before frontend screens.
- Required security tests (constitution V) must pass before the story is marked complete.
- Story complete before moving to the next priority.

### Parallel Opportunities

- Setup tasks marked [P] run in parallel.
- Foundational schema tasks T011–T017 and T020–T030 run in parallel once T010 is done.
- Within each story, [P] domain and frontend tasks run in parallel with each other.

---

## Parallel Examples

```bash
# Phase 2: schema migrations in parallel (after T010):
Task: "Create the Owner Account and Session schema in backend/migrations/0001_owner_session.sql"
Task: "Create the Ledger and Family schema in backend/migrations/0002_ledger_family.sql"
Task: "Create the Invoice and Payment schema in backend/migrations/0003_invoice_payment.sql"

# Phase 3 (US1): domain rules in parallel:
Task: "Implement invoice domain rules in backend/src/domain/invoice.ts"
Task: "Implement payment domain rules in backend/src/domain/payment.ts"
Task: "Implement Chase Today ranking in backend/src/domain/chaseToday.ts"
```

---

## Implementation Strategy

### MVP First (Phases 1–3)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks all stories), including the required security tests.
3. Complete Phase 3: US1 (Record, chase, recover payments).
4. **STOP and VALIDATE**: run the US1 independent test and the constitution V tests.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → test independently → MVP.
3. Add US2, then US3 → test each independently.
4. Add US4, then US5, then US6 → test each independently.
5. Polish → run quickstart checks S-A..S-H before release.
