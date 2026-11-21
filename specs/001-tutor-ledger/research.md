# Research: Tutor Ledger (Phase 0)

**Feature**: `001-tutor-ledger` | **Date**: 2026-11-21 | **Plan**: [plan.md](./plan.md)

Each entry records **Decision**, **Rationale**, **Security rationale** and **Alternatives considered**. Stack choices are a proposed stack to confirm. Items marked **OPEN** are not resolved by this document.

---

## R-1. Sync conflict handling (payments and invoices)

**Decision**: Payments are immutable, append-only events. Each payment event carries a client-generated UUID (`client_event_id`) and is stored with a unique constraint on `(ledger_id, client_event_id)`. The server never updates or overwrites a payment. An invoice's paid amount is derived from the sum of its payment events, not stored as a value that can be overwritten. Replaying a queued event with an existing `client_event_id` returns the original result and creates nothing (idempotent). Invoice non-money fields (e.g., status to void) use optimistic concurrency with a `version` column; a stale version is rejected with a conflict error and the owner is asked to re-read.

**Rationale**: Offline payment logging (FR-027, SC-008) produces events that may be sent twice or late. Append-only events with idempotency keys deliver "saved once, appears once" without losing either event when two devices or retries collide. Deriving the balance means there is no last-write-wins race on money.

**Security rationale**: Last-write-wins on money allows a stale or replayed client to silently overwrite a recorded payment, which is an integrity failure with no record of who changed what. Append-only events plus the audit trail keep every money change attributable. Overpayment is rejected rather than silently applied (a payment greater than the remaining balance returns a validation error and is not recorded unless the owner explicitly confirms a credit note path, which is out of scope for v1).

**Alternatives considered**:
- *Last-write-wins on invoice records*: rejected. Silent overwrite of money; no provenance.
- *CRDT or multi-master merge*: rejected. Multi-device sync is out of scope and the merge semantics for money are hard to audit.
- *Server rejects all offline events that conflict*: rejected. Loses the owner's entry, which violates SC-008.

---

## R-2. Session vs token authentication for a browser PWA

**Decision**: Server-side sessions. The session identifier is a random 256-bit value issued by the server, delivered as a cookie named `__Host-tl_session` with attributes `HttpOnly; Secure; SameSite=Strict; Path=/`. Only a SHA-256 hash of the session identifier (with a server-side pepper) is stored in the `sessions` table. Idle timeout is 15 minutes (FR-002), extended by activity; absolute lifetime is 12 hours, after which re-authentication is required even if active. CSRF protection is described in R-9.

**Rationale**: The app is a single-origin browser client with one owner. Cookies with server-side session state let the server revoke sessions instantly (logout, lockout, idle expiry) and keep the token out of JavaScript reach.

**Security rationale**: A token kept in JavaScript storage (`localStorage` or `sessionStorage`) is readable by any script that runs in the origin, so any XSS becomes full account takeover. An HttpOnly cookie is not readable by script. `__Host-` prefix forces `Secure`, `Path=/` and no `Domain`. `SameSite=Strict` removes cross-site request attachment for most CSRF cases. Hashing stored session identifiers means a database read does not yield usable session cookies.

**Alternatives considered**:
- *JWT in `localStorage`*: rejected. Script-readable, cannot be revoked without a denylist, and the idle timeout would have to be faked client-side.
- *Stateless signed JWT in an HttpOnly cookie*: rejected. Revocation and the 15-minute idle timeout need server state anyway, so the stateless benefit disappears.
- *Bearer token in `Authorization` header from a SPA*: rejected for the same storage reason as above.

---

## R-3. On-device storage of personal data while offline

**Decision (partial)**:
- The offline queue in IndexedDB holds **payment and invoice events only**, with fields limited to: `client_event_id`, `family_id` (UUID, not name), `invoice_id`, amount in minor units, currency code, date, source flag, and creation time. Phone numbers are never written to the device store.
- The queue is encrypted with a **non-extractable** AES-GCM `CryptoKey` generated with WebCrypto and stored in IndexedDB as a `CryptoKey` object, so script can use it but cannot export its raw bytes.
- All local stores (queue and any cache) are cleared on logout, on idle timeout, and on a successful sync confirmation for each event.
- Family display names needed to render the offline payment form are cached in memory only, not persisted.

**Status: OPEN (residual risk accepted for planning, not resolved).** A non-extractable key still lets anyone with live access to an unlocked browser profile use the app while it is unlocked. Because a family name cached for offline display would otherwise persist, we chose in-memory-only caching, which means the owner cannot see family names offline when the page is reloaded without connectivity. **Owner decision needed**: (a) accept in-memory-only caching and a reload-without-network limitation, or (b) allow persisted encrypted name cache with the residual risk recorded. Until decided, the plan uses (a).

**Rationale**: Payment logging needs only an ID and amount to be correct. Keeping names and numbers off the device store reduces what a stolen or shared device exposes.

**Security rationale**: IndexedDB content is readable from the browser profile on disk and by any script in the origin. Minimising fields limits the blast radius (Least Privilege); a non-extractable key prevents the raw key being copied out by script; clearing on logout and idle limits exposure on shared devices.

**Alternatives considered**:
- *Persist plaintext names and phones offline*: rejected. Maximum exposure on a lost device.
- *Derive the device key from the owner password*: rejected for v1. Adds a password-derived key that would need to be re-entered on every reload and creates an offline guessing target; the non-extractable key is simpler and bounded.
- *No offline support*: rejected. Violates FR-027 and SC-008.

---

## R-4. wa.me limits and phone normalisation

**Decision**:
- **Input validation**: owner enters the family phone number with country code. The API accepts only characters `0-9`, a single leading `+`, spaces, hyphens, dots and parentheses, with length 8 to 20 characters before normalisation. Anything else is rejected with a generic validation error that does not echo the value.
- **Normalisation**: strip spaces, hyphens, dots and parentheses; require the result to match E.164 `^\+[1-9][0-9]{7,14}$`; then remove the leading `+` to produce the digits-only string required by `wa.me`. Numbers without a country code are rejected (no default-country guessing in v1, to avoid sending to the wrong person).
- **Link**: `https://wa.me/<digits>?text=<encodeURIComponent(reminderText)>`. Built only on the server after validation and re-checked by the client's open action; the client never concatenates the number.
- **Message length**: reminder text is capped at 500 characters at generation time, so the encoded URL stays well below commonly-cited browser and OS URL length limits (about 2,000 characters). Limits in the `wa.me` documentation are not formally stated to the level needed here; **the 500-character cap is a conservative app-side choice, not a verified WhatsApp limit**, and must be checked during quickstart validation on Windows browsers.
- **Pre-fill behaviour**: WhatsApp may ignore or truncate pre-filled text on some clients. The owner reviews the text in WhatsApp before sending, so this is a usability risk, not a security risk.

**Rationale**: `wa.me` expects an international number in digits only; any other form either fails or routes to the wrong contact. Strict validation before link building is the trust boundary for the outbound channel.

**Security rationale**: Building the link from unvalidated input would allow arbitrary URL injection or redirection into a different chat. URL-encoding the message prevents characters such as `&` or `#` in a family name from altering the query string. The app never sends automatically (FR-025): the link is opened only after the owner's explicit action.

**Alternatives considered**:
- *WhatsApp Business API*: rejected. Automated sending is out of scope and needs a messaging-API credential (Assumptions, Out of Scope).
- *Default country code from ledger settings*: rejected for v1. Risk of wrong-recipient messages; revisit if the owner asks.
- *Storing the phone number in the URL path unencrypted*: not applicable; phone is decrypted only at link-building time and the URL is not logged (FR-007).

---

## R-5. Currency and minor-unit storage

**Decision**: All money is stored as a signed 64-bit integer `amount_minor` (BIGINT) in the smallest unit of the ledger currency. The ledger stores one ISO 4217 currency code (`currency_code`, CHAR(3)) and its exponent (e.g., USD 2, JPY 0, BHD 3), taken from a fixed table in code. The currency is chosen during setup and becomes read-only once any invoice or payment exists (FR-015). Amounts are never stored as floats. Percentage-based scenario changes (bill rises by a chosen percentage) compute `round_half_up(amount_minor * percent_bp / 10000)` where `percent_bp` is basis points (integer), so the arithmetic stays integral.

**Rationale**: Integer arithmetic avoids floating-point rounding drift, and the forecast's money arithmetic must be deterministic (F6, F7, unit-testable).

**Security rationale**: Money errors are integrity errors. Integer storage with explicit exponent handling prevents silent truncation or rounding that would misstate what is owed. Currency lock after first transaction prevents mixed-currency totals that could mislead the owner.

**Alternatives considered**:
- *DECIMAL/NUMERIC in Postgres with float in JS*: rejected. Mixed precision across layers.
- *Float or JS `number` for money*: rejected. Rounding error.
- *Multi-currency per ledger*: rejected by FR-015.

---

## R-6. Due-date timezone handling

**Decision**: Each ledger stores one IANA timezone identifier (`owner_timezone`, e.g., `Asia/Kolkata`), chosen during setup and editable in settings. Due dates and period boundaries are stored as calendar `DATE` values with no time component, interpreted in the ledger's timezone. Event timestamps (created, paid, audit) are stored as `timestamptz` in UTC. "Overdue" is evaluated as `today_in_owner_timezone > due_date`, where `today_in_owner_timezone` is computed server-side. The forecast's week 1 begins on the owner-local date on which the forecast is requested; weeks are seven-day blocks from that date. ISO week boundaries (Monday start) are used for the weekly alert cap (R-13).

**Rationale**: A tutor's due dates are local calendar dates. Storing UTC instants for due dates would shift dates across midnight for a family in another timezone.

**Security rationale**: Not directly security-relevant, but time-based controls (idle timeout, lockout windows) use server UTC clocks; keeping business dates separate avoids logic errors that could expose or hide overdue data incorrectly. The timezone is validated against the IANA database list at input.

**Alternatives considered**:
- *Store due dates as UTC timestamps*: rejected. Date drift near midnight.
- *Use the browser's timezone*: rejected. The server must compute overdue and alerts consistently, and a client-supplied timezone is untrusted input.

---

## R-7. Password hashing and owner authentication

**Decision**: Owner password is hashed with **argon2id** using the library's current OWASP-recommended minimum parameters (memory 19 MiB, 2 iterations, parallelism 1) or stronger, with a per-password random salt and a server-side pepper held in the secret store. Minimum password length 12 characters, maximum 128 (to bound hashing cost), no composition rules. Login is rate-limited (contracts/api.md, Rate limits) and locks the account for 15 minutes after 5 consecutive failures; the lockout is recorded in the audit trail without the username. First-run owner creation requires a **one-time setup secret** provisioned in the secret store at deployment; after the owner exists, the setup endpoint is disabled (fail closed).

**Passkeys**: **OPEN.** Passkeys (WebAuthn) are preferred for phishing resistance, and the spec allows them "if feasible". Feasibility depends on the chosen hosting domain, relying-party ID stability and recovery design. v1 ships with password plus argon2id as the required path; a passkey option is a follow-on decision.

**Rationale**: Single-owner ledger with personal data needs a strong, slow password hash and bounded online guessing.

**Security rationale**: argon2id resists GPU and ASIC cracking of a leaked hash table. Lockout and rate limits bound online guessing. The one-time setup secret stops anyone who finds the URL from claiming ownership of a new deployment. Lockout can be abused as a denial of service against the single owner; this is accepted as a trade-off, with per-IP limits and a short 15-minute lock bounding the impact.

**Alternatives considered**:
- *bcrypt or scrypt*: acceptable fallbacks; argon2id chosen as the memory-hard default.
- *Email magic links*: rejected for v1. Adds an email dependency and a new credential channel.
- *Open registration*: rejected. Anyone reaching the URL could claim the ledger.
- *Password reset*: **OPEN.** Recovery path for a forgotten password is not defined by the spec. Until decided, recovery requires operator-side reset of the stored hash through the migration role, with an audit entry.

---

## R-8. Field encryption and key management

**Decision**: Family name and phone number are encrypted at the application layer with **AES-256-GCM** (Node `crypto`), using a fresh 96-bit random nonce per encryption and the ledger ID and field name as additional authenticated data (AAD). Each ledger has a random 256-bit **data key (DEK)**, stored only in wrapped form (`wrapped_dek`), wrapped with a **key-encryption key (KEK)** held in a managed secret store (for example a cloud KMS or secret manager). The KEK never appears in the repository, environment files committed to source control, or logs. The API process retrieves the KEK at startup via its runtime identity. Deleting a family deletes its rows; because rows are deleted and not merely flagged, no ciphertext remains for that family in primary tables (backup behaviour is an open item, see Open Items).

**Rationale**: Field encryption protects personal data against database leaks and read-only backups of the database. Per-ledger DEKs limit blast radius and allow future rotation without re-keying every record at once.

**Security rationale**: Constitution IV requires encryption at rest with secrets from a managed store and vetted algorithms. AES-GCM is an authenticated mode, so tampering with a stored ciphertext is detected. AAD binds ciphertext to its row and field, so a ciphertext copied into another field fails to decrypt. A nonce reuse would be catastrophic for GCM; a random 96-bit nonce per encryption with an expected low volume (thousands of writes) keeps the collision probability negligible, and this is recorded as a constraint on the implementation.

**Alternatives considered**:
- *Database-level encryption only (TDE / disk encryption)*: insufficient alone; does not protect against an application-level read or a logical dump.
- *Single static key in an environment variable*: rejected. Key is not from a managed store and rotation is all-or-nothing.
- *Deterministic encryption for phone lookup*: rejected. Not needed in v1; avoiding it avoids a leakage channel.
- *Custom cipher or home-grown envelope format*: prohibited by Constitution IV.

---

## R-9. CSRF protection and Content-Security-Policy

**Decision**:
- **CSRF**: every state-changing request (POST, PUT, PATCH, DELETE) must carry a per-session CSRF token in the `X-CSRF-Token` header, issued by `GET /auth/session` and bound to the session (synchronizer token pattern, stored as an HMAC of the session identifier). The server also checks the `Origin` header against the configured app origin and rejects mismatches. `SameSite=Strict` on the session cookie is an additional layer, not the only one.
- **CSP**: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`. No inline scripts or inline event handlers. The Vite build emits external script files only. The service worker is a same-origin file. `wa.me` links are opened by user-initiated navigation, not by script fetch, so they are not blocked by `connect-src`.
- Additional headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`.

**Rationale**: Cookie-authenticated APIs need CSRF defence; the SPA must have a strict CSP so an injected script cannot run.

**Security rationale**: Synchronizer token plus Origin check makes cross-site form posts fail even on browsers without SameSite support. CSP limits the damage of any injection that does occur; `object-src 'none'` and `base-uri 'none'` close common bypasses.

**Alternatives considered**:
- *Double-submit cookie*: acceptable, but weaker because the token sits in a readable cookie if a subdomain is compromised; synchronizer token chosen.
- *CSRF token in a JS-readable cookie*: rejected for the same reason as R-2.

---

## R-10. Pasted or forwarded payment message parsing

**Decision**: Pasted text is accepted only through `POST /payments/parse-message`, which returns a **pre-filled payment form draft**. It writes nothing. Rules:
- Input capped at 2,000 characters; longer input is rejected with a generic error.
- Parsed by a bounded, non-recursive tokenizer (no regular expression with unbounded backtracking; no `eval`, no `Function`, no template execution, no deserialization).
- Extracts at most one **candidate amount** and one candidate date, each with a confidence level. Ambiguous cases (two or more amounts, currency mismatch, unparseable date) set `amount_flagged = true`.
- The response is a draft. Confirmation is a separate call (`POST /invoices/{id}/payments`) that requires `amount_minor` and `confirmed_amount_minor` to match and is refused while `amount_flagged` is set and not cleared by the owner (FR-023, FR-024).
- The raw pasted text is not stored and is not logged.

**Rationale**: Pasted text is third-party, untrusted input (Constitution III). Pre-fill with owner confirmation keeps the owner in control of what is recorded.

**Security rationale**: Evaluating or deserializing pasted content would be an injection path. Bounded parsing prevents ReDoS. Not storing or logging the raw message keeps personal data out of the database and logs (FR-007).

**Alternatives considered**:
- *Auto-record when confidence is high*: rejected by FR-023.
- *Server-side LLM extraction*: rejected. Sends personal message content to a third party, and is non-deterministic.
- *Store the raw message for audit*: rejected. Unnecessary personal data (FR-004).

---

## R-11. Forecast engine design

**Decision**: `forecast(opening_balance, open_invoices, payment_history, bills, scenario)` is a pure function in `shared/forecast`. It takes plain data, performs no I/O, reads no clock (the forecast start date is an input), uses integer minor-unit arithmetic only, and returns 13 weekly points. Each point carries a baseline, a best and a worst value, and a list of **source references** (record IDs and types) for every contribution (FR-034, SC-004). Each family's expected payment week is `due_date + average_delay_days`, where the average delay comes from `payment_history` (FR-032). Families with fewer than 3 recorded payments get `confidence = "low"`; families with none get no invented delay and a widened band (FR-035). Scenarios are pure transforms applied to the inputs before the forecast runs, so toggling a scenario never writes to the ledger (FR-038).

**Rationale**: A pure function is unit-testable with fixtures, deterministic under identical inputs, and cannot leak data or call out to a network.

**Security rationale**: No I/O imports means the module cannot exfiltrate or write data; the forecast receives only the rows it needs (Least Privilege). Integer arithmetic avoids the silent rounding that would misstate cash.

**Alternatives considered**:
- *Forecast computed in SQL*: rejected. Harder to unit-test; couples logic to the database.
- *Machine-learning forecasting*: out of scope (Out of Scope).

---

## R-12. Audit trail integrity

**Decision**: The `audit_events` table is append-only. The API role has INSERT and SELECT only; no UPDATE or DELETE is granted, and no application code path deletes audit rows. Family deletion (FR-006) does not cascade into the audit table: audit rows keep `family_id` as a plain UUID with no foreign key, so the deletion record survives without the family name or phone. Each audit row includes `prev_hash` and `row_hash`, where `row_hash = HMAC-SHA-256(audit_key, prev_hash || canonical_row)`, to make tampering detectable. The audit key is held in the secret store.

**Rationale**: FR-010 requires a trail the owner can view. Tamper evidence supports investigation (Constitution V).

**Security rationale**: Revoking UPDATE and DELETE from the application role means a compromised application cannot erase its own trail. The HMAC chain detects edits made with database superuser access. Audit rows hold IDs, action codes and counts, never names or phone numbers (FR-007).

**Alternatives considered**:
- *Audit via triggers only*: insufficient alone; does not detect superuser edits.
- *Store full before/after row images*: rejected. Would copy personal data into the audit trail.

---

## R-13. Alert engine

**Decision**: Rules are pure functions over the same inputs as the forecast and the invoice state. Evaluation runs on data change (for affected records) and once daily at a fixed time in the owner's timezone. Each alert has a `rule`, `severity` (integer rank), `linked_record_id`, and **exactly one** `action` from the enum `OPEN_REMINDER | OPEN_SCENARIO | OPEN_CHASE_TODAY` (FR-040). A weekly cap of 3 is applied on ISO week boundaries in the owner's timezone (FR-039); when more than 3 rules fire, the three highest-severity alerts are shown, ties broken by older `raised_at`. Changing the minimum-balance threshold re-evaluates cash alerts immediately (FR-041).

**Rationale**: Deterministic rules are testable and explainable to the owner. A fixed cap keeps the owner from being overwhelmed.

**Security rationale**: A single action per alert limits the navigation surface, and each action is a fixed enum that the client maps to an in-app route, not a URL from data. Alerts carry IDs only; the alert text is generated from templates, so no personal data is copied into alert records.

**Alternatives considered**:
- *Free-form action URLs*: rejected. Open redirect and injection risk.
- *Push notifications*: deferred. Adds a push-service dependency and background access to data.

---

## R-14. Stack selection

**Decision (proposed, to confirm)**: TypeScript throughout. Frontend React + Vite PWA. Backend Fastify on Node.js LTS. Validation with zod at every boundary. PostgreSQL 16 accessed via a driver using parameterized queries only.

**Rationale**: One language across the stack and the shared forecast module; mature, widely reviewed libraries; Fastify's schema and hook model suits the security plugins (session, CSRF, rate limits, headers) as explicit, testable hooks.

**Security rationale**: Parameterized queries remove string-built SQL (Constitution III). zod schemas make boundary validation explicit. A single strongly typed codebase reduces the chance that a field is used without its validation.

**Alternatives considered**:
- *Python (FastAPI) backend*: viable; not chosen because the forecast module would then need a second implementation or a cross-language bridge.
- *Server-rendered application*: viable; not chosen because the offline queue and installable PWA require a client-side app.
- *SQLite*: rejected for the server. Weaker role separation for the append-only audit requirement; PostgreSQL gives per-role grants.

---

## R-15. Plan-stage threat summary (STRIDE)

| Surface | Main threats | Planned mitigations |
|---|---|---|
| Login | Credential guessing, lockout abuse | argon2id; 5-failure lock for 15 min; per-IP and per-account rate limits; audit without username (R-7) |
| Session | Hijack, fixation, replay after idle | Server-side session, hashed IDs, `__Host-` HttpOnly cookie, 15-min idle, 12-h absolute (R-2) |
| API | Injection, IDOR across ledgers | zod at boundary; parameterized SQL; `ledger_id` from session only; 404 for foreign IDs (contracts/api.md) |
| Browser | XSS, CSRF, clickjacking | Text-only rendering; strict CSP; synchronizer token and Origin check; `frame-ancestors 'none'` (R-9) |
| Offline queue | Device theft, shared-device exposure | Minimal fields, non-extractable key, clear on logout and idle (R-3, OPEN) |
| wa.me hand-off | Wrong recipient, URL injection, auto-send | E.164 validation, encoded text, owner-initiated open only (R-4) |
| Pasted messages | Injection, ReDoS, bad amounts | Bounded parser, length cap, pre-fill only, confirmation gate (R-10) |
| Export | Bulk personal-data disclosure | Re-authentication within 5 min, no-store headers, audit entry, no caching (contracts/api.md) |
| Logs and errors | Personal data leakage | Redaction config and tests (quickstart S-8) (FR-007) |
| Data at rest | DB dump, backup exposure | Field encryption, DEK/KEK, deletion removes rows (R-8; backups OPEN) |

**Status**: Plan-stage model. A security-focused review of this table is a gate before implementation (plan.md Constitution Check).

---

## Open Items

1. **OPEN (R-3)**: Whether to persist an encrypted family-name cache on the device for offline use. Plan uses in-memory-only caching until the owner decides.
2. **OPEN (R-7)**: Passkey support (WebAuthn) — feasibility and recovery design not yet decided.
3. **OPEN (R-7)**: Account recovery for a forgotten owner password is not defined by the spec. Plan allows operator-side reset with audit.
4. **OPEN (R-8)**: Backup retention and purge. Deleted family rows are removed from primary tables, but backups may still contain ciphertext. Need a retention period and a rule for backup purge or crypto-erasure.
5. **OPEN (R-4)**: Verify the practical pre-fill length and behaviour of `wa.me` text on Windows Chrome and Edge; the 500-character cap is a conservative app choice.
6. **OPEN (Plan gate)**: Security review sign-off of the threat summary (R-15) before implementation starts.
7. **OPEN (Contract)**: Whether payment corrections (reversal of a recorded payment) are needed in v1. The spec does not define one, so no reversal endpoint is included.
8. **OPEN (Stack)**: Confirm the proposed stack (R-14), Node LTS line and PostgreSQL version before scaffolding.
