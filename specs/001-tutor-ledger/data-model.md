# Data Model: Tutor Ledger (Phase 1)

**Feature**: `001-tutor-ledger` | **Date**: 2026-11-21 | **Inputs**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

**Conventions**
- Every operational table has `ledger_id UUID NOT NULL`. Every query filters on `ledger_id` taken from the server-side session (FR-003).
- Primary keys are UUID v4 generated server-side. Timestamps are `timestamptz` (UTC). Business dates are `DATE` in the ledger timezone (research R-6).
- Money is `BIGINT amount_minor` in the ledger currency's minor unit (research R-5).
- **[ENC]** marks a field encrypted at the application layer with AES-256-GCM under the ledger DEK, using the row ID and field name as AAD (research R-8). Encrypted fields are stored as `bytea` (`nonce || ciphertext || tag`) and never appear in logs.
- **[SENS]** marks other sensitive fields (not encrypted, but excluded from logs, errors and analytics).
- `is_sample_data` exists only on Family, Invoice, Payment and Recurring Bill. Do not add it to other entities.

## Ledger (container; supports Owner Account)

| Field | Type | Notes | Source FR |
|---|---|---|---|
| `id` | UUID PK | | FR-003 |
| `currency_code` | CHAR(3) | ISO 4217; set during setup; read-only once any invoice or payment exists (read-only rule enforced in application layer; no DB trigger or constraint) | FR-015 |
| `currency_exponent` | SMALLINT | From fixed code table (e.g., USD 2, JPY 0); DB CHECK range 0–4; code-to-exponent mapping is application-enforced | FR-015 |
| `owner_timezone` | TEXT | IANA identifier; validated in the domain layer against the IANA list (no DB CHECK) | R-6 |
| `minimum_balance_minor` | BIGINT | Threshold for cash alerts; default 0; changing it re-evaluates alerts | FR-012, FR-041 |
| `opening_balance_minor` | BIGINT | Opening bank balance (may be negative to model overdraft) | FR-012 |
| `is_sample_data` | BOOLEAN | Ledger-level flag; sample rows are also flagged per row | FR-014 |
| `wrapped_dek` | BYTEA [SENS] | Per-ledger data key wrapped by KEK; never stored unwrapped | R-8 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | |

Constraints: `minimum_balance_minor >= 0`. Setup completes with only FR-011 and FR-012 items present (FR-013).

`currency_code`, `currency_exponent` and `owner_timezone` are NULL until setup completes. Setup requires them non-null; this is enforced in the application layer, not by a DB NOT NULL.

## Owner Account

Spec Key Entity "Owner Account": exactly one per ledger in v1 (FR-003).

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | UUID PK | No | | FR-003 |
| `ledger_id` | UUID FK → Ledger, UNIQUE | No | Enforces one owner per ledger | FR-003 |
| `password_hash` | TEXT [SENS] | No (hash) | argon2id encoded string incl. salt and params; pepper applied from secret store | R-7 |
| `failed_login_count` | SMALLINT | No | Reset on success; lock at 5 (5-failure lockout is application-enforced; DB CHECK only requires the counter is >= 0) | R-7, FR-001 |
| `locked_until` | timestamptz NULL | No | Set to now + 15 min after 5 failures | R-7 |
| `session_idle_minutes` | SMALLINT | No | Fixed at 15 by DB CHECK; not user-editable (cannot be raised above or set below 15) | FR-002 |
| `last_reauth_at` | timestamptz NULL | No | Used for export and permanent delete (5-minute window) | FR-005, FR-006 |
| `signed_in_state` | derived | No | Derived from `sessions`, not stored | FR-001 |
| `created_at` | timestamptz | No | NOT NULL DEFAULT now() | |

Validation: password length 12–128 characters; no composition rules. Password is never logged or echoed.

## Session (supports auth; not a spec entity)

| Field | Type | Notes |
|---|---|---|
| `id_hash` | BYTEA PK | SHA-256 of session identifier with pepper; the raw identifier is never stored |
| `ledger_id` | UUID FK | Source of truth for scoping (FR-003) |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `last_seen_at` | timestamptz | Idle timeout: `now - last_seen_at > 15 min` ends session (FR-002) |
| `absolute_expires_at` | timestamptz | `created_at + 12 h` |
| `csrf_secret_hash` | BYTEA | For synchronizer token (R-9) |

## Family

Spec Key Entity "Family". Defaults used by invoice creation (FR-016).

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | UUID PK | No | | |
| `ledger_id` | UUID FK | No | | FR-003 |
| `name_ct` | BYTEA [ENC] | Yes | Family name; stored encrypted, so the length check runs before encryption; never logged | FR-004, FR-007 |
| `phone_ct` | BYTEA [ENC] | Yes | E.164 digits-with-plus; stored encrypted, so the E.164 check runs before encryption; never logged | FR-004, FR-007, R-4 |
| `phone_digits_hash` | BYTEA | No (HMAC) | HMAC of normalised phone for duplicate detection only; keyed with secret store key, not reversible; indexed, NOT unique (duplicates are warned, not merged) | FR-004 |
| `default_fee_minor` | BIGINT | No | ≥ 0; default 0 | FR-011, FR-016 |
| `default_term_days` | SMALLINT | No | Payment term in days, 0–365; default 0 | FR-011, FR-016 |
| `default_tone` | TEXT | No | Enum: `friendly`, `neutral`, `firm`; default `neutral` | FR-011, FR-020 |
| `avg_delay_days` | NUMERIC(6,2) NULL | No | Derived from payment history; NULL when no history; never invented (spec edge case) | FR-032, FR-035 |
| `payment_count` | INTEGER | No | Derived; < 3 means thin history; default 0 | FR-035 |
| `is_sample_data` | BOOLEAN | No | Sample rows removable without affecting owner rows | FR-014 |
| `created_at` | timestamptz | | NOT NULL DEFAULT now() | |

Validation: name 1–100 characters, trimmed, no control characters; phone per research R-4; `default_fee_minor` within ledger money range. Duplicate phone within a ledger is warned, not silently merged.

Relationships: Family 1—* Invoice; Family 1—* Payment; Family 1—* Reminder Draft; Family 1—* Alert (via linked record). Family delete cascades to Invoice, Payment, Reminder Draft; audit rows remain with `family_id` as plain UUID (R-12).

## Invoice

Spec Key Entity "Invoice". Balance is derived, not stored (R-1).

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | UUID PK | No | | |
| `ledger_id` | UUID FK | No | | FR-003 |
| `family_id` | UUID FK | No | | FR-016 |
| `period_start` | DATE | No | Start of the period covered | FR-022 |
| `period_end` | DATE | No | `>= period_start` | FR-022 |
| `amount_minor` | BIGINT | No | Invoice total; > 0 | FR-016 |
| `issue_date` | DATE | No | | |
| `due_date` | DATE | No | `>= issue_date` | FR-019 |
| `status` | TEXT | No | Enum; see state transitions | FR-021 |
| `version` | INTEGER | No | Optimistic concurrency for non-money edits (R-1); default 1, minimum 1 | FR-027 |
| `is_sample_data` | BOOLEAN | No | | FR-014 |
| `created_at`, `updated_at` | timestamptz | No | NOT NULL DEFAULT now() | FR-010 |

Uniqueness: `UNIQUE (ledger_id, family_id, period_start)` — database-level guarantee for FR-022 (no duplicate invoices for the same family and period).

Derived values (never stored): `paid_minor = SUM(payment.amount_minor)` for the invoice; `remaining_minor = amount_minor - paid_minor`; `days_overdue = today_owner_tz - due_date` when positive and remaining > 0.

### Invoice state transitions

States: **draft**, **due-awaiting-confirmation**, **open**, **partially-paid**, **paid**, **void**.

| From | To | Trigger | Guard / rule | Source FR |
|---|---|---|---|---|
| (none) | draft | Owner starts invoice creation from family defaults | Family exists in ledger | FR-016 |
| draft | open | Owner confirms once | Fee and term filled from defaults; amount > 0 | FR-016 |
| (none) | due-awaiting-confirmation | Repeat invoice generation for a family and period | Created only if no invoice exists for `(family, period_start)` | FR-021, FR-022 |
| due-awaiting-confirmation | open | Owner confirms that invoice | Owner action required; no auto-confirm | FR-021 |
| due-awaiting-confirmation | void | Owner discards | Void is terminal | FR-021 |
| open | partially-paid | Payment recorded with `0 < paid < amount` | Payment is append-only; remaining balance shown | FR-017, FR-018 |
| open | paid | Payment recorded covering `remaining_minor` | Sum of payments equals amount | FR-017 |
| partially-paid | partially-paid | Further partial payment | Remaining stays > 0 | FR-018 |
| partially-paid | paid | Payment covers remaining | Remaining = 0 | FR-017 |
| open / partially-paid | void | Owner voids | Blocked if any payment exists (to keep money history intact); owner must reverse first (open item) | FR-010 |
| paid | (none) | — | Terminal for money; corrections are an open item | R-1 |

Rejected transitions: any payment that would exceed `remaining_minor` (overpayment) returns a validation error and writes nothing. Any transition from `paid` or `void` by payment is rejected. Every transition writes an Audit Event.

## Payment

Spec Key Entity "Payment". Append-only (R-1).

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | UUID PK | No | | |
| `ledger_id` | UUID FK | No | | FR-003 |
| `family_id` | UUID FK | No | | FR-010 |
| `invoice_id` | UUID FK | No | One payment applies to one invoice in v1 | FR-017 |
| `client_event_id` | UUID | No | Client-generated idempotency key | FR-027, R-1 |
| `amount_minor` | BIGINT | No | > 0; ≤ remaining at time of recording | FR-017, FR-018 |
| `date_received` | DATE | No | Ledger-timezone business date | FR-017 |
| `source` | TEXT | No | Enum: `owner_entry`, `confirmed_pasted_message` | Spec Payment attrs |
| `was_offline` | BOOLEAN | No | True when queued on device before sync | FR-027 |
| `recorded_at` | timestamptz | No | Server time of acceptance | FR-010 |
| `pasted_amount_flagged` | BOOLEAN | No | Set when a pasted-message amount was flagged; must be cleared by owner before confirm | FR-024 |
| `is_sample_data` | BOOLEAN | No | | FR-014 |

Constraints: `UNIQUE (ledger_id, client_event_id)` (idempotency, R-1). `CHECK (amount_minor > 0)`. No UPDATE or DELETE from the application role on payment rows, except cascade deletion through family removal (FR-006). The raw pasted message is **not stored** (R-10). Payment amount ≤ remaining invoice balance is application-enforced, in the same operation that updates the invoice status (no DB constraint).

## Recurring Bill

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | UUID PK | No | | |
| `ledger_id` | UUID FK | No | | FR-003 |
| `name` | TEXT | No | 1–100 characters; bill names are not personal data by spec (FR-004 lists only name, phone, amounts, dates for families) | FR-012 |
| `amount_minor` | BIGINT | No | ≥ 0 | FR-012, FR-033 |
| `frequency` | TEXT | No | Enum: `monthly` (v1 spec says monthly bills) | FR-012 |
| `next_due_date` | DATE | No | Ledger-timezone date | FR-033 |
| `is_active` | BOOLEAN | No | Inactive bills excluded from forecast; default true | Spec Key Entity |
| `is_sample_data` | BOOLEAN | No | | FR-014 |

Relationship: bills produce outflows in the forecast in the week of `next_due_date` and subsequent monthly occurrences within the 13-week horizon (FR-033).

## One-off Expense

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | UUID PK | No | | |
| `ledger_id` | UUID FK | No | | FR-003 |
| `description` | TEXT | No | 1–140 characters | Spec Key Entity |
| `amount_minor` | BIGINT | No | > 0 | FR-033 |
| `expense_date` | DATE | No | Week in which it falls due is its date | FR-033 |

## Scenario

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | UUID PK | No | | |
| `ledger_id` | UUID FK | No | | FR-003 |
| `name` | TEXT | No | 1–80 characters | FR-036 |
| `type` | TEXT | No | Enum: `builtin_late_payment`, `builtin_family_leaves`, `builtin_new_family`, `builtin_bill_rise`, `combination`, `custom` | FR-036 |
| `parameters` | JSONB | No | Validated per type by zod schema (e.g., `family_id`, `days` ≤ 90, `from_date`, `percent_bp` in 0–10000). No free-form expressions. Default `{}` | FR-036 |
| `is_on` | BOOLEAN | No | Toggling does not change ledger records (FR-038); default false | FR-038 |

Built-in and combined scenarios use the same parameter schema. A custom scenario is limited to the same allowed transforms; it may not run arbitrary code or query.

## Reminder Draft

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | UUID PK | No | | |
| `ledger_id` | UUID FK | No | | FR-003 |
| `family_id` | UUID FK | No | | FR-020 |
| `invoice_id` | UUID FK | No | | FR-020 |
| `tone` | TEXT | No | Enum: `friendly`, `neutral`, `firm` | FR-011 |
| `text_ct` | BYTEA [ENC] | Yes | Rendered from template with plain-text placeholder values; contains family name, so encrypted | FR-004, FR-007 |
| `drafted_at` | timestamptz | No | | FR-020 |
| `out_of_date` | BOOLEAN | No | Set true when invoice becomes paid after drafting; default false | FR-026 |
| `send_confirmed_at` | timestamptz NULL | No | Recorded when owner confirms the wa.me open; the app does not record that WhatsApp actually sent | FR-025 |

Validation: text ≤ 500 characters (R-4), checked by the application before encryption (no DB check). Placeholders available: `{family_name}`, `{amount}`, `{due_date}`, `{days_overdue}`. Values are inserted as plain text; markup is not interpreted. Before the wa.me link is produced, the server checks the invoice status; if paid, the send is refused and the owner is shown the paid status (FR-026).

## Alert

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | UUID PK | No | | |
| `ledger_id` | UUID FK | No | | FR-003 |
| `rule` | TEXT | No | Enum of rule codes (e.g., `CASH_BELOW_MINIMUM`, `INVOICE_OVERDUE`) | FR-039 |
| `severity` | SMALLINT | No | Higher = more urgent; used for ordering and cap; CHECK 1–10 | FR-039 |
| `raised_at` | timestamptz | No | | FR-039 |
| `iso_week` | TEXT | No | e.g., `2026-W47` in owner timezone; for weekly cap | FR-039 |
| `linked_record_type` | TEXT | No | `invoice`, `family`, `scenario`, `ledger` | FR-040 |
| `linked_record_id` | UUID | No | ID only; no names or phones | FR-040, FR-007 |
| `action` | TEXT | No | Exactly one of `OPEN_REMINDER`, `OPEN_SCENARIO`, `OPEN_CHASE_TODAY` | FR-040 |
| `dismissed_at` | timestamptz NULL | No | | |

Constraint: `action` is NOT NULL with a CHECK against the three values; there is no multi-action column.

Rule constraint: the `rule` CHECK allows exactly `CASH_BELOW_MINIMUM` and `INVOICE_OVERDUE`. Severity is SMALLINT 1–10.

## Audit Event

Spec FR-010 audit trail. Append-only (R-12).

| Field | Type | Encrypted | Notes | Source FR |
|---|---|---|---|---|
| `id` | BIGINT identity PK | No | Monotonic order | FR-010 |
| `ledger_id` | UUID | No | Plain UUID; no FK so it survives deletion | FR-010 |
| `occurred_at` | timestamptz | No | UTC | FR-010 |
| `actor` | TEXT | No | `owner`, `system`, `anonymous` | FR-010 |
| `action_code` | TEXT | No | Length 1–64; no DB enum (the listed action codes are enforced by the application); e.g., `AUTH_LOGIN_OK`, `AUTH_LOGIN_FAIL`, `AUTH_LOCKOUT`, `AUTHZ_DENIED`, `INVOICE_CREATED`, `INVOICE_CONFIRMED`, `INVOICE_VOIDED`, `PAYMENT_RECORDED`, `PAYMENT_PARSE_CONFIRMED`, `FAMILY_DELETED`, `EXPORT_REQUESTED`, `SAMPLE_DATA_REMOVED`, `CONFIG_CHANGED` | FR-010, Constitution V |
| `subject_type` | TEXT | No | `family`, `invoice`, `payment`, `bill`, `expense`, `scenario`, `ledger`, `session` | FR-010 |
| `subject_id` | UUID NULL | No | No foreign key | FR-010 |
| `detail` | JSONB | No | Counts and IDs only (e.g., `{"payments_deleted": 3, "invoices_deleted": 2}`); application forbids these detail keys: `name`, `phone`, `family_name`, `phone_e164`, `message`, `text` | FR-007, FR-004 |
| `prev_hash` | BYTEA | No | Chain link | R-12 |
| `row_hash` | BYTEA | No | HMAC over prev_hash and canonical row | R-12 |

Grants: application role INSERT and SELECT only. No UPDATE or DELETE. FR-006 deletion does not touch audit rows.

## Offline Queue Item (device only; not a server table)

| Field | Type | Notes | Source FR |
|---|---|---|---|
| `client_event_id` | UUID | Same as Payment idempotency key | FR-027 |
| `type` | TEXT | `payment` or `invoice_confirm` | FR-027 |
| `family_id`, `invoice_id` | UUID | No names, no phones | R-3 |
| `amount_minor`, `currency_code`, `date_received` | integer, text, DATE | | FR-017 |
| `queued_at` | timestamptz | | FR-027 |
| `payload_ct` | BYTEA [ENC on device] | Encrypted with non-extractable WebCrypto key | R-3 |

Cleared on logout, idle timeout, and per-event on server acknowledgement (research R-3, OPEN).

## Forecast outputs (computed, not stored)

- `ForecastPoint { week_index 1..13, week_start DATE, baseline_minor, best_minor, worst_minor, inflows[], outflows[], confidence }`.
- Each inflow or outflow item carries `source_type` and `source_id` (FR-034).
- Lowest cash week and below-minimum flag are derived for the scenario view (FR-037).

## Indexes

- Family: index on `ledger_id`; index on `phone_digits_hash`, NOT unique (duplicates are warned, not merged).
- Payment: index on `invoice_id`.
- Session: index on `ledger_id`.
- Alert: index on `ledger_id`, and on `ledger_id` + `iso_week` for the weekly cap.
- Audit Event: index on `ledger_id`.

## Deletion cascades

- Deleting an Invoice cascades to its Payments and Reminder Drafts.
- Deleting a Family cascades to its Invoices (and therefore their Payments and Reminder Drafts).
- Deleting a Ledger cascades to all operational tables. Audit Event rows have no FK and survive.

## Storage

Database-level guarantees (constraints, role grants, transactions) apply on the Postgres path only. A JSON-file emulator is used as a development fallback when no connection string is set, and its transactions are not enforced.
