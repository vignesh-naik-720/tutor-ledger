# Quickstart: Tutor Ledger validation scenarios (Phase 1)

**Feature**: `001-tutor-ledger` | **Date**: 2026-11-21 | **Platform**: Windows 10/11, PowerShell 7

This document describes how to set up a local environment and run validation scenarios. It contains no implementation. Commands assume the proposed layout in [plan.md](./plan.md) and the stack in [research.md](./research.md) R-14 (to be confirmed). Until the code exists, these steps are the acceptance script.

## 1. Prerequisites

- Windows 10/11 with PowerShell 7.4 or later.
- Node.js current LTS (proposed 22.x), installed from the official installer; confirm with `node --version`.
- npm (bundled with Node); the repository uses committed lockfiles, so use `npm ci`, not `npm install`.
- Docker Desktop (for disposable PostgreSQL 16) with WSL 2 backend enabled.
- Git for Windows.
- A modern browser (Microsoft Edge or Chrome) for the PWA and manual checks.
- A local secret store stand-in for development only: a `.env.local` file that is **git-ignored** and holds development-only values. Production secrets come from the managed secret store, never from this file (Constitution IV).

Verify tooling:

```powershell
node --version
npm --version
docker --version
git --version
```

## 2. Setup (Windows PowerShell)

Run from the repository root, `C:\Users\Vignesh\OneDrive\Desktop\cb-project`.

```powershell
# Confirm .gitignore excludes local secret files before anything else
Select-String -Path .gitignore -Pattern '\.env' -SimpleMatch

# Start disposable PostgreSQL for development (credentials come from the git-ignored .env.local)
docker compose up -d db

# Backend: install from lockfile, run migrations under the migration role
cd backend
npm ci
npm run db:migrate

# Frontend
cd ..\frontend
npm ci

# Shared forecast tests need no database
cd ..\shared\forecast
npm ci
```

Expected outcome: all installs complete without `npm audit` failures blocking install; `db:migrate` reports all migrations applied; the database role used by the API cannot run DDL (check in S-9).

## 3. Starting the app

```powershell
# Terminal 1: API (HTTPS in dev via local certificate; plain HTTP is refused)
cd backend
npm run dev

# Terminal 2: frontend
cd frontend
npm run dev
```

Open `https://localhost:5173` in Edge. A certificate warning is expected only for the local dev certificate; it must not be bypassed for any non-local host.

## 4. First-run setup (P2 flow, FR-011..FR-013)

1. Browse to the app. Setup status shows "owner not created".
2. Enter the one-time setup secret from `.env.local` (`SETUP_SECRET`) and choose a password of at least 12 characters.
3. Choose currency (e.g., GBP), owner timezone (e.g., `Europe/London`).
4. Add one family: name, phone with country code (e.g., `+44 7700 900123`), default fee, default term, default tone.
5. Enter opening bank balance, one recurring monthly bill and minimum balance.
6. Skip every optional item and finish.

Expected outcomes:
- Setup finishes in under 5 minutes for a first-time owner (SC-001).
- Main screens (Chase Today, Who owes me, Forecast, Alerts) are reachable with no optional items (FR-013).
- Re-visiting `/setup/owner` now returns a disabled response because the owner exists (fail closed).

## 5. Sample data mode (FR-014)

1. In Settings, choose "Load sample data".
2. Expected: 12 families appear, each labelled as sample data; two bill cycles appear; the forecast shows a cash dip in week 7.
3. Choose "Remove sample data" and confirm with reauthentication.
4. Expected: only rows marked sample are removed; the family and bill you entered in step 4 remain (Story 2 acceptance 4).

Development-only command (proposed; not a production path):

```powershell
cd backend
npm run db:seed-sample -- --ledger-id <your-ledger-uuid>
```

## 6. Demo flow for P1 (Story 1)

Run after section 5, with sample data loaded.

1. Open "Who owes me". Expected: families with balances listed with outstanding, oldest unpaid date and total; totals and average days-to-pay shown; long lists show top entries with "show all" (FR-028..FR-030).
2. Create an invoice for one family using saved defaults. Expected: one confirmation; invoice open with fee and term from defaults; under 10 seconds of owner interaction (SC-002, FR-016).
3. Open the invoice and tap "Mark paid in full". Expected: at most two taps after opening; invoice closes; family balance drops by the amount (FR-017).
4. Open another invoice and record a partial payment. Expected: invoice stays open with remaining balance (FR-018).
5. Open "Chase Today". Expected: each overdue invoice once, ordered by score then older due date (FR-019).
6. Open an item. Expected: reminder drafted from template with plain-text values; nothing sent (FR-020, FR-025).
7. Press "Open in WhatsApp" and confirm. Expected: browser opens `https://wa.me/<digits>?text=<encoded>` in a new tab; WhatsApp shows the pre-filled text for the owner to send from her own account (FR-025). Nothing is sent by the app.
8. Timing: owner can find a late family and open a reminder in under 60 seconds (SC-003).

## 7. Validation scenarios mapped to success criteria

| Scenario | Steps | Expected outcome | Maps to |
|---|---|---|---|
| S-A Setup time | Section 4 timed | Under 5 minutes | SC-001 |
| S-B Repeat invoice time | Section 6 step 2 timed | Under 10 seconds | SC-002 |
| S-C Late family to reminder | Section 6 steps 1, 5–7 timed | Under 60 seconds | SC-003 |
| S-D Forecast traceability | Open forecast; select 10 figures at random; open sources | 100% of selected figures show source records | SC-004, FR-034 |
| S-E Scenario toggle | Toggle one built-in scenario on and off | Forecast updates with no visible delay; ledger unchanged | SC-005, FR-038 |
| S-F Alert actions | Trigger each alert rule using sample data | Each alert shows exactly one action; each action opens its named destination; at most 3 shown | SC-006, FR-039, FR-040 |
| S-G Weekly entry | Time a full week's entries (3 payments, 2 invoices, 1 expense) | Under 10 minutes | SC-007 |
| S-H Offline payment | See section 8 | Saved offline; appears once after reconnect | SC-008, FR-027 |

## 8. Offline payment check (FR-027, SC-008)

1. Sign in and open the invoice list so data is loaded.
2. In Edge DevTools (F12), Network tab, set throttling to "Offline".
3. Record a full payment on an open invoice. Expected: the app shows "saved on this device, will sync"; the invoice displays as pending, not as recorded on the server.
4. Set throttling back to "No throttling". Expected: the queue syncs; the payment appears once in the ledger with `was_offline = true`.
5. Repeat step 4 by reloading the page during sync. Expected: still exactly one payment (idempotency by `client_event_id`).
6. Check the queue: IndexedDB contains no family name or phone number (DevTools > Application > IndexedDB). Expected: only IDs, amounts, dates (research R-3).

## 9. Security checks

Each check below must also exist as an automated test (Constitution V). Manual steps here are for the acceptance walk-through.

### S-1 Login lockout (FR-001, R-7)

1. Open the login page. Submit a wrong password 5 times.
2. Expected: on the 5th failure the response is `LOCKED_OUT` with `Retry-After` near 900 seconds; the message does not say whether the account exists.
3. Submit the correct password during lockout. Expected: still refused.
4. Wait 15 minutes (or use the test clock in the automated suite). Expected: login accepted.
5. Audit trail shows `AUTH_LOGIN_FAIL` ×5 and `AUTH_LOCKOUT`, with no password or name.

### S-2 Idle timeout after 15 minutes (FR-002)

1. Sign in. Leave the browser idle with no interaction for 15 minutes (or 16 minutes with the automated clock).
2. Trigger any request (e.g., open Chase Today).
3. Expected: `SESSION_EXPIRED`; the app returns to login; no data is shown; the offline queue is cleared (research R-3).
4. Expected: `GET /auth/session` during activity shows `idle_timeout_seconds` counting down and extends with activity.

Absolute lifetime check: after 12 hours of continuous activity the session still ends (`SESSION_EXPIRED`).

### S-3 Cross-ledger access denied (FR-003)

1. Create a second ledger in the test database (test fixture only).
2. Sign in as owner of ledger A. Using the ID of a family in ledger B (from fixture), call `GET /invoices/{id}` and `PATCH /families/{id}`.
3. Expected: `404 NOT_FOUND` in both cases; no field of ledger B is returned.
4. Attempt a request with a `ledger_id` field in the body. Expected: `VALIDATION_FAILED` (unknown field rejected).
5. Attempt an unauthenticated request to `GET /families`. Expected: `UNAUTHENTICATED` and no data.

### S-4 Pasted payment message is not recorded without confirmation (FR-023, FR-024)

1. Paste this test string into the parser (fixture text, not real data): `Hi, I sent 150 and also 15 for the book. Thanks`.
2. Expected: a pre-filled draft is shown with `amount_flagged = true` because two candidate amounts exist; the confirm button is disabled until the owner selects one amount.
3. Before confirming, check the Payments list and the audit trail. Expected: no payment was created and no audit `PAYMENT_RECORDED` entry exists.
4. Paste a 2,001-character string. Expected: `VALIDATION_FAILED`; nothing parsed; nothing stored.
5. Paste a string containing HTML such as `<img src=x onerror=alert(1)>`. Expected: shown as plain text; no script runs; nothing recorded (FR-023).
6. Confirm only after an explicit owner action. Expected: one payment with `source = confirmed_pasted_message`.

### S-5 Reminder never sent automatically (FR-025)

1. Create a reminder draft for an overdue invoice.
2. Leave the app open and idle for 24 hours (or use the automated clock and daily job).
3. Expected: no `open-link` call is made by any job; no `send_confirmed_at` is set; no outbound network request to `wa.me` occurs from the server (check the server egress log is empty for `wa.me`).
4. Press "Open in WhatsApp" and confirm. Expected: the link opens only after this owner action; `send_confirmed_at` is set; the app does not claim the message was sent.
5. Enter a phone with letters (`+44 abc`). Expected: `VALIDATION_FAILED`; no link produced (R-4).
6. Pay the invoice, then try to open the reminder. Expected: `CONFLICT` with paid status shown; no URL (FR-026).

### S-6 Personal data absent from logs and errors (FR-007)

1. Run the automated redaction suite: it creates a family named `Test Family Name` and phone `+447700900123`, then triggers validation failure, login failure, parse failure and a forced server error.
2. Search the captured server log and any error response body for `Test Family Name`, `447700900123`, `7700900123`, and the reminder text. Expected: zero matches.
3. Manual equivalent: `Select-String -Path backend\logs\*.log -Pattern 'Test Family Name|7700900123'` after the steps above. Expected: no output.

### S-7 Encryption at rest (FR-004, FR-008, R-8)

1. Using the database admin shell (not the app role), query the family table for the test family.
2. Expected: `name_ct` and `phone_ct` are binary values; no plain-text name or phone appears.
3. Expected: `wrapped_dek` is present on the ledger row and is not a raw key.

### S-8 Audit trail is append-only (FR-010, R-12)

1. Connect as the API application role and attempt `UPDATE audit_events SET action_code = 'X'`. Expected: permission denied.
2. Attempt `DELETE FROM audit_events`. Expected: permission denied.
3. Delete a family in the UI (with reauth). Expected: `FAMILY_DELETED` audit row with counts only; no name or phone in `detail`.

### S-9 Role separation

1. Connect as the API application role and attempt `CREATE TABLE`. Expected: permission denied.
2. Confirm that migrations succeed only with the migration role.

### S-10 CSRF and headers

1. In DevTools, copy a POST request to `/families` and replay it without the `X-CSRF-Token` header. Expected: `CSRF_FAILED`.
2. Replay with a foreign `Origin` header. Expected: refused.
3. Check response headers on the app shell: `Content-Security-Policy` contains `script-src 'self'` and no `unsafe-inline`; `Strict-Transport-Security` present; `X-Content-Type-Options: nosniff`.

### S-11 Export and deletion need reauthentication (FR-005, FR-006)

1. Without reauth in the last 5 minutes, request `GET /export`. Expected: `REAUTH_REQUIRED`.
2. After reauth, export. Expected: a JSON file containing every record in the ledger; the audit trail shows `EXPORT_REQUESTED` with no content.
3. Delete a family with reauth. Expected: family and its invoices, payments and drafts are gone; attempting to view them returns `NOT_FOUND`.

## 10. Running tests (proposed)

```powershell
# Shared forecast unit tests (pure; no database)
cd shared\forecast
npm test

# Backend unit and integration tests (integration uses the disposable PostgreSQL)
cd ..\..\backend
npm run test:unit
npm run test:integration

# Frontend component tests
cd ..\frontend
npm test

# End-to-end (Playwright; runs the P1 demo, offline, idle, cross-ledger scenarios)
npx playwright test

# Dependency and static checks (CI blocks on high or critical)
cd ..\backend
npm audit --audit-level=high
npm run lint
```

Expected outcome: all suites pass; `npm audit` reports no high or critical findings; the redaction suite (S-6) and the lockout, idle, cross-ledger, parser and reminder suites (S-1..S-5) pass. Each suite must fail if its control is removed (Constitution V); verify this at least once per control during implementation.

## 11. Forecast checks (FR-031..FR-035)

Run the forecast unit tests with these fixtures (expected outcomes are in the test file, not computed here):

- Invoice due on week 3 with a family average delay of 7 days lands in week 5 (FR-032).
- Bill due in week 2 produces outflow in week 2 only (FR-033).
- Family with 2 payments shows confidence `low` (FR-035).
- Family with 0 payments shows no invented delay and a widened band (FR-035, edge case).
- Same inputs produce byte-identical output twice (determinism).
- Percentage bill rise uses integer basis points with round-half-up (research R-5).

## 12. Known limits of this quickstart

- No shell or test run was performed while writing this document; it is a plan-stage script.
- `wa.me` pre-fill length and behaviour must be verified on Windows Edge and Chrome (research R-4, OPEN).
- Backup purge behaviour is not covered (research R-8, OPEN).
