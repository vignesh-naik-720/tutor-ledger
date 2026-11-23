# Implementation Plan: Tutor Ledger

**Branch**: `001-tutor-ledger` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-tutor-ledger/spec.md`

**Note**: This plan was filled in from the spec and `.specify/memory/constitution.md` (v1.0.0). Stack choices below are a **proposed stack to confirm**; the repository is greenfield and contains no code yet. Host OS is Windows; all paths are written for Windows PowerShell with forward-slash relative paths inside this document.

## Summary

Tutor Ledger is a single-owner, WhatsApp-first back office for an individual tutor. It records families, invoices and payments, produces a "Chase Today" list of overdue invoices with reviewable reminders, shows who owes money, produces a 13-week cash forecast with what-if scenarios, and raises at most three rule-based alerts per week, each with exactly one action.

Security is the primary design driver. The technical approach is:

- A TypeScript single-page app (installable PWA) talking to a TypeScript JSON API over TLS, with server-side sessions in an HttpOnly, Secure, SameSite=Strict cookie, a 15-minute idle timeout (FR-002), and an absolute lifetime.
- All authorization is server-side and every query is scoped by the `ledger_id` taken from the server-side session, never from client input (FR-003).
- Personal data (family names, phone numbers) is encrypted at the application layer with AES-256-GCM under per-ledger keys wrapped by a key-encryption key held in a managed secret store (FR-004, FR-008).
- Money is integer minor units with one currency per ledger (FR-015). Payments are append-only events, so sync conflicts cannot silently overwrite money (FR-027).
- Reminders are generated from server-side templates and opened as `wa.me` links only after the owner reviews them; the app never sends automatically (FR-025).
- Pasted payment messages only pre-fill a form and are treated as untrusted input (FR-023, FR-024).
- The forecast engine is a pure, deterministic TypeScript module with no I/O, using integer arithmetic only (FR-031..FR-035).
- An append-only audit trail records payments, invoice changes, deletions, and authentication events without personal data (FR-010, FR-007).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) on the current Node.js LTS line (proposed: Node 22 LTS; confirm before pinning). Browser target: current evergreen Chrome, Edge, Safari, Firefox.

**Primary Dependencies** (proposed; all pinned with exact versions and committed lockfiles):
- Frontend: React + Vite, a PWA service worker (Workbox or equivalent), `idb` for IndexedDB access, a schema library (zod) shared with the API for client-side form validation (advisory only).
- Backend: Fastify (HTTP JSON API), zod for request/response schemas at every boundary, `pg` driver with parameterized queries only, an argon2id library (`argon2` npm package), Node `crypto` module for AES-256-GCM (vetted primitive; no custom cryptography), a structured logger (pino) with a redaction configuration.
- Shared: `packages/forecast` (pure TypeScript, no I/O dependencies).

**Storage**: PostgreSQL 16 (proposed). Application role has SELECT/INSERT/UPDATE/DELETE on operational tables and only SELECT/INSERT on the audit table (no UPDATE/DELETE). Schema migrations run under a separate migration role that is not used at request time. Browser: IndexedDB for the offline queue (see research R-3 for the open risk).

**Testing**: Vitest for unit tests (forecast engine, validation schemas, phone normalisation, message parser, alert rules, redaction); Fastify `inject` for API integration tests against a disposable PostgreSQL; Playwright for end-to-end flows (P1 demo, offline payment, idle timeout, cross-ledger denial). Dependency and static checks: `npm audit` (or equivalent), ESLint with security plugin rules, and a secret scanner in CI. No tests are written by this plan; test scenarios are listed in `quickstart.md`.

**Target Platform**: Installable responsive PWA in modern mobile and desktop browsers; server is a Linux container behind HTTPS (TLS 1.2+ minimum, TLS 1.3 preferred). The owner's workstation is Windows; development commands are written for Windows PowerShell.

**Project Type**: Web application (SPA frontend + JSON API backend + shared pure module). Not a native app (native distribution is out of scope).

**Performance Goals**: Assumed single-owner scale (≤ 100 families, ≤ 5,000 invoices and payments per year). API p95 under 300 ms for non-forecast reads and writes; forecast build under 200 ms; scenario toggle reflected in the UI without a perceivable delay (SC-005); repeat invoice creation completable in under 10 seconds of owner interaction (SC-002).

**Constraints**:
- Fail closed: no protected data without a valid session (FR-001).
- Offline-capable for payment logging only (FR-027, SC-008); all other screens require connectivity.
- No payment credentials or bank login details stored anywhere (FR-008).
- No automatic outbound messages (FR-025); the app moves no money (FR-009).
- Logs, errors and analytics must not contain family names or phone numbers (FR-007).
- Single owner per ledger in v1 (FR-003).

**Scale/Scope**: One owner, one ledger, one currency, one tutoring practice. 13 forecast weeks. Up to 3 alerts per week (FR-039). Sample dataset of 12 families (FR-014).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Each line below is taken from `.specify/memory/constitution.md` v1.0.0. Every PASS names the concrete plan decision that satisfies it. No violations are declared, so Complexity Tracking stays empty.

**Core Principles**

- **I. Secure by Default — PASS.** All `/api/v1` routes are denied unless they are on an explicit public allow-list (`POST /auth/login`, `GET /setup/status`); see contracts/api.md. Cookie flags (HttpOnly, Secure, SameSite=Strict), CSP, HSTS and CSRF are fixed server defaults, not options. Sample-data mode is opt-in and labelled. Setup-only owner creation is closed after the owner exists (research R-7).
- **II. Least Privilege — PASS.** The API database role cannot UPDATE or DELETE the audit table and has no DDL rights; migrations run under a separate role (Storage). The KEK is readable only by the API process identity. The app holds no bank or payment credentials and no messaging-API token, because none is used (FR-008, Assumptions). The forecast module has no I/O imports, so it cannot reach the network or the database.
- **III. Validate at Trust Boundaries — PASS.** Every request body, query string and path parameter is parsed by a zod schema with explicit type, length and range limits before use (contracts/api.md, Common rules). SQL is parameterized only. Output is encoded for its destination: the UI renders user data as text (no `dangerouslySetInnerHTML`); `wa.me` URLs are built with normalised digits and `encodeURIComponent`. The pasted-message parser is a bounded tokenizer that never evaluates or deserializes its input and caps input at 2,000 characters (research R-10).
- **IV. Secrets and Data Protection — PASS.** Secrets (KEK, audit HMAC key, session pepper, database password) are loaded at runtime from a managed secret store and never committed (research R-8). Family names and phone numbers are encrypted with AES-256-GCM using per-ledger data keys wrapped by the KEK. Passwords use argon2id. No custom cryptography: only Node `crypto` AES-GCM and the argon2id library are used.
- **V. Verified, Auditable Changes — PASS (as a plan commitment; tests not yet written).** quickstart.md names an automated test for each security control: login lockout, idle timeout, CSRF rejection, cross-ledger denial, parser non-recording, reminder non-automatic send, and log redaction. Those tests must fail when the control is removed. Lockfiles are committed, and CI runs a dependency vulnerability scan that blocks on high or critical findings. Authentication events, authorization denials and configuration changes are written to the audit trail without secrets or personal data (FR-010).

**Security Requirements**

- **Server-side authentication and authorization on every protected operation — PASS.** Session is resolved server-side on each request; `ledger_id` comes from the session and no endpoint accepts a `ledger_id` from the client (contracts/api.md, Auth). Client-side checks (route guards, hidden buttons) are advisory only.
- **Transport uses TLS; no plaintext for sensitive data — PASS.** HTTPS only; HTTP redirects to HTTPS at the edge; HSTS with `max-age=31536000; includeSubDomains`; cookies are `Secure`; the service worker is served only over HTTPS. Database connections use TLS (`sslmode=verify-full`).
- **Dependencies from trusted registries, pinned, reviewed — PASS.** npm public registry only (no custom or git-sourced packages without review); exact versions pinned; lockfiles committed; `npm ci` in CI; new or upgraded dependencies reviewed in pull request, with the reviewer checking the package's maintainers and install scripts (the argon2 native binding is reviewed on upgrade).
- **Security headers, CSRF protection and rate limiting on externally reachable web interface — PASS.** Headers: strict CSP (`default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, HSTS. CSRF: per-session synchronizer token sent in a header on every state-changing request, plus Origin checking, plus SameSite=Strict (research R-9). Rate limits per endpoint group (contracts/api.md, Rate limits).
- **Threat modelling before implementation — PASS (plan-stage model; sign-off gate open).** A STRIDE threat summary for the external surfaces (login, API, PWA, offline queue, wa.me hand-off, pasted-message parser, export) is recorded in research.md R-15. A security-focused review of that model is a gate that must be passed before implementation begins (see research.md Open Items).

## Project Structure

### Documentation (this feature)

```text
specs/001-tutor-ledger/
├── plan.md              # This file
├── research.md          # Phase 0: decisions, rationale, alternatives, security notes
├── data-model.md        # Phase 1: entities, fields, encryption, state transitions
├── quickstart.md        # Phase 1: validation scenarios (Windows PowerShell)
├── contracts/
│   └── api.md           # Phase 1: /api/v1 endpoint contract
├── spec.md              # Feature specification (input)
└── tasks.md             # Phase 2 output (/speckit.tasks; NOT created here)
```

### Source Code (repository root)

Proposed layout, to be confirmed. Nothing in this tree exists yet.

```text
# PROPOSED — Web application: frontend + backend + shared pure module

frontend/                           # PROPOSED: React + Vite PWA
├── src/
│   ├── app/                        # routing, route guards (advisory only), PWA registration
│   ├── pages/                      # Chase Today, Who owes me, Forecast, Alerts, Setup, Audit, Export
│   ├── components/                 # text-only rendering of user data; no dangerouslySetInnerHTML
│   ├── services/
│   │   ├── api-client.ts           # fetch wrapper: credentials included, CSRF header, no token in JS storage
│   │   └── offline-queue.ts        # IndexedDB queue of payment and invoice events (see research R-3)
│   └── sw/                         # service worker source (served from same origin, no inline script)
└── tests/                          # component tests (Vitest + Testing Library); e2e lives in /e2e

backend/                            # PROPOSED: Fastify JSON API over PostgreSQL
├── src/
│   ├── api/
│   │   ├── v1/                     # route modules per contracts/api.md
│   │   ├── plugins/                # session, csrf, rate-limit, security-headers, error-model
│   │   └── schemas/                # zod request/response schemas (boundary validation)
│   ├── services/                   # invoices, payments, reminders, alerts, audit, export, sample-data
│   ├── models/                     # row mappers; no SQL string building
│   ├── db/
│   │   ├── migrations/             # run under migration role only
│   │   └── queries/                # parameterized SQL only
│   ├── crypto/                     # AES-256-GCM field encryption, KEK/DEK handling, argon2id wrapper
│   ├── security/                   # phone normalisation, message parser, redaction config
│   └── config/                     # secret-store loader; no secrets in files
└── tests/
    ├── unit/                       # validation, redaction, parser, phone normalisation, alert rules
    └── integration/               # Fastify inject against disposable Postgres

shared/forecast/                    # PROPOSED: pure, deterministic forecast engine
├── src/
│   ├── forecast.ts                 # forecast(opening_balance, open_invoices, payment_history, bills, scenario)
│   ├── scenarios.ts                # built-in and custom scenario transforms (pure)
│   └── money.ts                    # integer minor-unit helpers (no floats)
└── tests/                          # unit tests only; no I/O imports allowed
```

**Structure Decision**: Web application layout with three packages: `frontend/` (browser SPA and PWA), `backend/` (API, persistence, crypto, security services) and `shared/forecast/` (pure module). The forecast lives in its own package so it has no I/O imports by construction, which keeps it unit-testable and prevents it from reaching data or network it does not need (Least Privilege). Layout is PROPOSED and must be confirmed before scaffolding.

## Complexity Tracking

> No Constitution Check violations. Nothing is declared as a justified exception.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |
