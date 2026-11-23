# backend

Tutor Ledger JSON API (Fastify, zod, PostgreSQL 16). See `specs/001-tutor-ledger/contracts/api.md`.

Rules: parameterized SQL only; ledger_id comes from the session only; no secrets in the repo (see `.env.example` for key names).
