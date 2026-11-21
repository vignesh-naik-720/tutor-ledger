# API Contract: Tutor Ledger `/api/v1`

**Feature**: `001-tutor-ledger` | **Date**: 2026-11-21 | **Inputs**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

This is an interface contract, not implementation. Request and response shapes are summarised; each is validated by a zod schema at the boundary.

## Common rules

- **Transport**: HTTPS only. JSON bodies only (`Content-Type: application/json`); other content types are rejected.
- **Auth**: every endpoint requires a valid session cookie (`__Host-tl_session`) except the explicit public list below. Auth is "session" unless marked "public" or "reauth".
- **Reauth**: marked endpoints additionally require `last_reauth_at` within the last 5 minutes (re-enter password via `POST /auth/reauth`).
- **CSRF**: every POST, PUT, PATCH and DELETE requires header `X-CSRF-Token` matching the session's token, and an `Origin` header equal to the configured app origin (research R-9).
- **Ledger scope**: `ledger_id` is never accepted from the client. It is taken from the session. A request for a record in another ledger returns `404 NOT_FOUND`, so existence is not revealed (FR-003).
- **Input rules**: unknown fields are rejected; strings are trimmed, length-capped and control-character-free; numeric money fields are integers in minor units; dates are `YYYY-MM-DD`; IDs are UUID.
- **Responses**: `Cache-Control: no-store` on every endpoint that returns personal data. Money values are integers with the ledger currency code in the envelope.
- **Idempotency**: payment and invoice-confirm writes require `client_event_id` (UUID) in the body; replays return the original result (research R-1).
- **Security headers**: applied to all responses (CSP, HSTS, nosniff, Referrer-Policy: no-referrer).

## Error model

All errors use one envelope:

```text
{ "error": { "code": "<STABLE_CODE>", "message": "<fixed catalogue text>", "request_id": "<id>", "fields": [ { "path": "<field name>", "rule": "<rule code>" } ] } }
```

- `code` is from a fixed catalogue: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `CSRF_FAILED`, `REAUTH_REQUIRED`, `RATE_LIMITED`, `CONFLICT`, `LOCKED_OUT`, `PAYMENT_FLAGGED`, `INTERNAL`.
- `message` is fixed text from the catalogue. It **never** echoes submitted values, family names, phone numbers, message text, or internal exception details.
- `fields[].path` gives the field name only; the rejected value is not returned.
- `LOCKED_OUT` returns the same shape and a `Retry-After` header; it does not say whether the username exists.
- Stack traces are not returned; they go to the server log with redaction (FR-007).

## Rate limits

| Group | Limit (proposed) | Scope | Response |
|---|---|---|---|
| Login `POST /auth/login` | 5 failed attempts per account per 15 min → lock 15 min; 20 attempts per IP per 15 min | account and IP | `LOCKED_OUT` / `RATE_LIMITED` with `Retry-After` |
| Reauth | 5 attempts per 15 min | session | `RATE_LIMITED` |
| Parse message | 30 per minute | session | `RATE_LIMITED` |
| Export `GET /export` | 3 per hour | ledger | `RATE_LIMITED` |
| General API | 120 per minute | session | `RATE_LIMITED` |

Limits are enforced server-side; client-side throttling is advisory only.

## Auth requirements summary

- Session idle timeout 15 minutes; absolute lifetime 12 hours (FR-002, R-2).
- Session cookie: `__Host-tl_session`; HttpOnly; Secure; SameSite=Strict; Path=/.
- Logout invalidates the server-side session immediately.

## Endpoints

### Auth and setup

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| GET | `/setup/status` | Returns whether the owner exists and whether setup is complete (no personal data) | public | FR-001, FR-013 |
| POST | `/setup/owner` | First-run owner creation with one-time setup secret; disabled once owner exists | public (one-time secret) | FR-001 |
| POST | `/auth/login` | Sign in with password; creates session | public, rate-limited | FR-001, FR-002 |
| POST | `/auth/logout` | End session | session | FR-002 |
| GET | `/auth/session` | Return session status, seconds until idle expiry, and CSRF token | session | FR-002 |
| POST | `/auth/reauth` | Re-enter password for sensitive actions | session | FR-005, FR-006 |
| PUT | `/settings/minimum-balance` | Set minimum-balance threshold; triggers alert re-evaluation | session, CSRF | FR-012, FR-041 |
| PUT | `/settings/ledger` | Set currency (only before first invoice or payment), timezone, opening balance | session, CSRF | FR-012, FR-015 |

Login request: `{ "password": "<string 12–128>" }` (username not needed: single owner). Response: `{ "status": "ok", "idle_timeout_seconds": 900 }` or `UNAUTHENTICATED` (generic). Password is never logged.

### Setup and sample data

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| POST | `/setup/sample-data` | Load 12 sample families, two bill cycles and week 7 cash dip, all flagged `is_sample_data` | session, CSRF | FR-014 |
| DELETE | `/setup/sample-data` | Remove only rows flagged `is_sample_data`; owner rows remain | session, CSRF, reauth | FR-014 |

### Families

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| GET | `/families` | List families (name, defaults; phone masked to last 4 digits) | session | FR-011, FR-004 |
| POST | `/families` | Create family: name, phone (E.164 with country code), default fee, term, tone | session, CSRF | FR-011 |
| PATCH | `/families/{id}` | Update family fields and defaults | session, CSRF | FR-011 |
| DELETE | `/families/{id}` | Permanently delete family and all its invoices, payments and reminder drafts; audited; not recoverable | session, CSRF, reauth | FR-006, FR-010 |

Phone validation and normalisation: research R-4. Phone is returned masked (`+•••••1234`) in list views; full phone is available only via the reminder open step.

### Bills and expenses

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| GET | `/bills` | List recurring bills | session | FR-012, FR-033 |
| POST | `/bills` | Create recurring monthly bill | session, CSRF | FR-012 |
| PATCH | `/bills/{id}` | Update amount, next due date, active flag | session, CSRF | FR-033 |
| POST | `/expenses` | Create one-off expense | session, CSRF | FR-033 |

### Invoices

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| POST | `/invoices` | Create invoice for a family from saved defaults in one confirmation (`family_id`, `client_event_id`) | session, CSRF | FR-016 |
| POST | `/invoices/generate-repeat` | Generate due-awaiting-confirmation invoices for a period; skips existing `(family, period)` | session, CSRF | FR-021, FR-022 |
| POST | `/invoices/{id}/confirm` | Owner confirms a due-awaiting-confirmation invoice (`client_event_id`, `version`) | session, CSRF | FR-021 |
| POST | `/invoices/{id}/void` | Void an invoice without payments (`version`) | session, CSRF | Data model |
| GET | `/invoices/{id}` | Invoice with derived paid and remaining amounts, status and source payments | session | FR-017, FR-018 |

### Payments

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| POST | `/invoices/{id}/payments` | Record full or partial payment (`amount_minor`, `date_received`, `client_event_id`, `source`, `was_offline`). Refused if over remaining, if flagged, or if invoice is paid/void | session, CSRF | FR-017, FR-018, FR-027 |
| POST | `/payments/parse-message` | Pasted or forwarded text (≤ 2,000 characters) → pre-filled draft; **writes nothing** | session, CSRF | FR-023, FR-024 |

Parse response: `{ "draft": { "amount_minor": <int or null>, "date": "<YYYY-MM-DD or null>", "amount_flagged": <bool>, "candidates": <count> } }`. The pasted text is not echoed back and is not stored. Confirming a parsed draft uses `POST /invoices/{id}/payments` with `source = "confirmed_pasted_message"`; that endpoint requires the owner's confirmed amount and refuses while the amount is flagged (FR-024).

### Chase Today and Who owes me

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| GET | `/chase-today` | Overdue invoices, once each, ordered by priority score (desc), then older due date; includes family display name, remaining amount, days overdue | session | FR-019 |
| GET | `/who-owes` | Families with balance: outstanding, oldest unpaid date, total; ledger totals; average days to pay. Query `limit` (default 5) and `all=true` for "show all" | session | FR-028, FR-029, FR-030 |

### Reminders

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| POST | `/reminders` | Draft reminder for an invoice from server template (`invoice_id`, `tone`); placeholders inserted as plain text | session, CSRF | FR-020 |
| GET | `/reminders/{id}` | Return draft text, tone, `out_of_date` flag and current invoice paid status | session | FR-026 |
| POST | `/reminders/{id}/open-link` | Validate phone, check invoice is not paid, record owner confirmation, and return the `wa.me` URL for the owner to open. **Never sends automatically** | session, CSRF | FR-025, FR-026 |

Open-link response: `{ "url": "https://wa.me/<digits>?text=<encoded>" }` only when the owner's confirmation flag is set in the request body (`"owner_confirmed": true`). If `out_of_date` or invoice is paid, returns `CONFLICT` with the paid status and no URL.

### Forecast and scenarios

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| GET | `/forecast` | 13-week forecast with baseline, best/worst band, confidence per family, lowest cash week, below-minimum flag. Query `scenario_ids` (comma-separated UUIDs, optional) | session | FR-031, FR-032, FR-033, FR-035, FR-037 |
| GET | `/forecast/lines/{line_id}/sources` | Source invoices, payments, bills or expenses behind a figure | session | FR-034 |
| GET | `/scenarios` | List built-in and custom scenarios with on/off state | session | FR-036 |
| POST | `/scenarios` | Create custom scenario (allowed transform parameters only) | session, CSRF | FR-036 |
| PATCH | `/scenarios/{id}` | Switch on or off, or edit parameters | session, CSRF | FR-036, FR-038 |

Scenario toggles never write to invoices, payments, bills or expenses (FR-038).

### Alerts

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| GET | `/alerts` | Up to 3 alerts for the current ISO week, most urgent first; each has exactly one `action` enum | session | FR-039, FR-040 |

### Audit and export

| Method | Path | Purpose | Auth | FR |
|---|---|---|---|---|
| GET | `/audit` | Paginated audit events (action code, subject type, subject ID, time, counts) | session | FR-010 |
| GET | `/export` | Full ledger export as a single JSON download with `Content-Disposition: attachment` and no-store caching | session, reauth | FR-005 |

Export contains decrypted personal data by design; it is generated on request, audited as `EXPORT_REQUESTED` (no content in audit), and rate-limited.

## Out of contract (not in v1)

- Any endpoint that sends a message automatically (FR-025; Out of Scope).
- Bank or payment credential endpoints (FR-008).
- Multi-user, invitation or sharing endpoints (FR-003; Out of Scope).
- Payment reversal or correction (research.md Open Items, item 7).
- Password reset (research.md Open Items, item 3).
