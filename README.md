# Tutor Ledger

WhatsApp-first back office for solo home tutors: fee tracking, a chase queue for overdue fees, and a 13-week cash forecast.

This README covers how to run the prototype on Windows. Design details live in [`specs/001-tutor-ledger/`](specs/001-tutor-ledger/).

## 1. Overview

Tutor Ledger has three parts:

- **Backend**: Fastify API (`backend/`), API under `/api/v1`.
- **Frontend**: React/Vite web app (`frontend/`), served by nginx in Docker.
- **Shared forecast library**: pure TypeScript cash forecast (`shared/forecast/`).

Data is stored in PostgreSQL or in a local JSON file (see [Data persistence](#10-data-persistence)).

## 2. Prerequisites

1. **Node.js 22 or later** (required for all methods).
2. **Docker Desktop with the WSL 2 backend** (only for Method 1, Docker Compose).
3. **PowerShell 7.4 or later** (only for `start.ps1` and `setup-postgres.ps1`).
4. **PostgreSQL 18** (only for `setup-postgres.ps1`, the native database option).

## 3. Configuration

1. Copy the example file to `.env` in the repo root (or `backend/.env.example` to `backend/.env`):
   ```powershell
   Copy-Item .env.example .env
   ```
   The backend looks for `.env` in the root, `backend/.env` and `../.env`. It does **not** read `.env.local`.
2. Set these keys. Each is required:

   | Key | Purpose |
   | :--- | :--- |
   | `TL_SESSION_PEPPER` | 64 hex characters. Keys the session-token hash. |
   | `TL_AUDIT_HMAC_KEY` | 64 hex characters. Keys the audit-log hash chain. |
   | `TL_FIELD_ENCRYPTION_KEK` | 64 hex characters. Encrypts names and phone numbers at rest. |
   | `TL_PHONE_HMAC_KEY` | 64 hex characters. Keys the phone-number lookup hash. |
   | `TL_SETUP_SECRET` | Secret needed to create the first owner account. |
   | `TL_DATABASE_URL` | PostgreSQL URL. **Leave blank** to use the JSON-file store. |

3. Optional keys:
   - `TL_MIGRATION_DATABASE_URL`: needed for `npm run migrate`.
   - `GEMINI_API_KEY`: leave blank to use the offline message parser.
   - `PORT`, `HOST`, `NODE_ENV`.

4. Generate a 64-hex key in PowerShell (standard usage, not verified in repo; check the output on your Windows machine):
   ```powershell
   -join ([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32) | ForEach-Object { $_.ToString('x2') })
   ```
   Run it once per 64-hex key.

5. **Replace every placeholder key** in `.env` before any use beyond your own machine. The example file contains development values.

**Note:** The frontend's one-click demo sign-in uses a hardcoded setup secret. If you change `TL_SETUP_SECRET`, the one-click demo first-run path will fail. See [Troubleshooting](#13-troubleshooting).

## 4. Method 1: Docker Compose

Runs four containers: Postgres 16, Adminer, backend and frontend.

1. Make sure Docker Desktop is running.
2. From the repo root:
   ```powershell
   docker compose up --build
   ```
   (Standard usage, not verified in repo.)
3. Open the services:

   | Service | URL | Notes |
   | :--- | :--- | :--- |
   | Web app | http://localhost:5173 | nginx; proxies `/api/` to the backend |
   | Backend | http://localhost:3001 | Health/welcome page at `/`; API at `/api/v1` |
   | Adminer | http://localhost:8080 | Database viewer |

4. Wait for the backend to start. The backend waits for a healthy Postgres, but the frontend does not wait for the backend. If the page loads early and shows errors, refresh after the backend is up.

**Stop the stack** (keeps data):
```powershell
docker compose down
```
(Standard usage, not verified in repo.)

**Reset the database** (deletes the `pgdata` volume and all data):
```powershell
docker compose down -v
```
(Standard usage, not verified in repo.)

**Check status and logs** (standard usage, not verified in repo):
```powershell
docker compose ps
docker compose logs -f backend
```

**Adminer login** (standard usage, not verified in repo):
- System: PostgreSQL
- Server: `postgres`
- Username: `postgres`
- Password: the one set for the `postgres` service in the Compose file
- Database: `tutor_ledger`

**Known limitation:** Sign-in over plain `http://localhost` under Compose may fail. The `__Host-` session cookie is always secure, and the other cookie is secure only in production. Both use `SameSite=Lax`. Treat this as a known limitation of the prototype.

Postgres is also published on host port **5432**. If you run a separate local PostgreSQL on 5432, it will conflict.

## 5. Method 2: Start scripts (Windows)

From the repo root in PowerShell 7.4+:
```powershell
.\start.ps1
```
Or double-click `start.bat` in Explorer.

The scripts:
1. Open the backend in a new window.
2. Open the frontend dev server in a new window.
3. Wait 3 seconds, then open http://localhost:5173 in your browser.

The 3-second wait is **not** a readiness check. If the page shows an error, wait a few seconds and refresh.

With a blank `TL_DATABASE_URL`, data is stored in `backend/data/tutor_ledger_store.json`.

## 6. Method 3: Manual steps

1. Install dependencies (standard usage, not verified in repo):
   ```powershell
   npm install
   ```
2. **Only if using PostgreSQL**: run migrations from `backend` (needs `TL_MIGRATION_DATABASE_URL`):
   ```powershell
   cd backend
   npm run migrate
   cd ..
   ```
3. Open two terminals in the repo root.
   - Terminal 1, backend (http://localhost:3001):
     ```powershell
     npm run dev:backend
     ```
   - Terminal 2, frontend (http://localhost:5173):
     ```powershell
     npm run dev:frontend
     ```
   Equivalent: `npm --prefix backend run dev` and `npm --prefix frontend run dev`.

The frontend dev server uses plain HTTP and proxies `/api` to `localhost:3001`. Use `http://localhost:5173`.

## 7. First-run owner setup

1. Start the stack with any method above.
2. In the web app, create the first owner account. When asked for the setup secret, enter the value of `TL_SETUP_SECRET`.
3. Once an owner exists, the setup endpoint returns `409`. A wrong secret returns `403`.

## 8. Demo credentials and sample data

- **One-click demo**: on http://localhost:5173, use the demo sign-in button.
- **Demo password** (demo value only, never use it outside local testing): `Password123456`

When the database is PostgreSQL, startup runs migrations and seeds a demo dataset of sample families, invoices and recurring bills.

## 9. Core features

- **Chase queue**: overdue invoices ranked by urgency. Each item opens a WhatsApp draft (`https://wa.me/...`) in Gentle, Standard or Firm tone.
- **No automatic sending**: the app never sends a reminder on its own. The tutor reviews and sends each one (spec rule FR-025).
- **Simulated WhatsApp companion**: open http://localhost:5173/?view=whatsapp to simulate parent messages and confirm payments.
- **13-week cash forecast**: calculated with integer minor units (no floating point). Flags weeks where cash falls below the safety threshold.
- **Offline parser**: with no `GEMINI_API_KEY`, the app uses its built-in offline parser.

## 10. Data persistence

| Mode | When | Where data lives |
| :--- | :--- | :--- |
| PostgreSQL | `TL_DATABASE_URL` starts with `postgres` | Postgres. Migrations and seed run at startup. Compose uses the `pgdata` volume. |
| JSON file | `TL_DATABASE_URL` blank, `embedded` or `sqlite` | `backend/data/tutor_ledger_store.json` |

**Silent fallback:** If Postgres is set but unreachable (connection refused, host not found, or timeout), the backend switches to the JSON store and only logs a warning. Check the backend log if data seems to be missing or different.

## 11. Native PostgreSQL option (local development only)

`setup-postgres.ps1` sets up a local PostgreSQL 18 instance for development:

- Expects the default PostgreSQL 18 Windows install path.
- Puts data under `backend`.
- Uses port **5433** (not 5432).
- Initializes with `-A trust`, meaning no password check.

**Local development only. Do not use this setup for anything exposed to a network.**

Then point `TL_DATABASE_URL` at the instance on port 5433, and continue with Method 3.

## 12. Testing

From the repo root:
```powershell
npm test
npm run build
```
Per package:
```powershell
npm --prefix backend test
npm --prefix shared/forecast test
```

CI runs only the backend and `shared/forecast` tests. Frontend tests are not in CI.

## 13. Troubleshooting

- **Port already in use** (5173, 3001, 5432, 5433, 8080): stop the other process, or stop the stack first.
- **Data missing or different after restart**: the backend may have silently fallen back to the JSON store. Check the backend log for the warning (see [Data persistence](#10-data-persistence)).
- **Sign-in fails on http://localhost under Compose**: see the known limitation in [Method 1](#4-method-1-docker-compose).
- **5432 vs 5433**: Compose Postgres uses 5432. `setup-postgres.ps1` uses 5433. Make sure `TL_DATABASE_URL` matches the one you started.
- **Page errors right after startup**: the UI may load before the API is ready. Refresh.
- **One-click demo fails**: `TL_SETUP_SECRET` was changed. The demo button uses a hardcoded secret. Restore the original value, or use the manual owner setup in [section 7](#7-first-run-owner-setup).

## 14. Architectural invariants

As described in the specs:

1. **No automatic sending**: reminders are generated as links for the tutor to review and send.
2. **Integer money math**: forecasts and totals use minor units, not floats.
3. **Encrypted contact data**: names and phone numbers are encrypted at rest and kept out of logs.
4. **Tamper-evident audit log**: audit events are chained with HMAC.

## 15. Further reading

- [Spec](specs/001-tutor-ledger/spec.md)
- [Plan](specs/001-tutor-ledger/plan.md)
- [Data model](specs/001-tutor-ledger/data-model.md)
- [API contract](specs/001-tutor-ledger/contracts/api.md)
- [Quickstart](specs/001-tutor-ledger/quickstart.md)
