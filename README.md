# 📚 Tutor Ledger — WhatsApp-First Back Office for Solo Home Tutors

> **Tutor Ledger** is a zero-friction, WhatsApp-first financial management and cash flow forecasting application designed specifically for independent home tutors. It eliminates fee collection anxiety, prevents embarrassing financial surprises, and turns awkward payment chases into respectful, one-click WhatsApp communications.

---

## 🌟 Why Tutor Ledger?

Independent home tutors provide high-touch, relationship-driven education. However, managing receivables manually creates three major pain points:
1. **Fee Collection Anxiety**: Asking parents for overdue money feels socially awkward and risks damaging tutor-parent rapport.
2. **Holiday Cash Flow Dips**: School holidays, exam breaks, and seasonal lulls cause sharp, unexpected revenue drops.
3. **Admin Chaos & Fragmented Messaging**: Payment confirmations arrive sporadically as messy WhatsApp text snippets, UPI screenshots, or SMS bank alerts.

**Tutor Ledger solves all three:**
- **Chase Today**: Daily prioritization of overdue fees with 1-click WhatsApp (`wa.me`) reminder drafts in 3 relationship-safe tones (Gentle, Standard, Firm). **Strictly zero auto-send** to preserve trust.
- **Deterministic 13-Week Cash Forecast**: Rolling cash projections with drill-down line-item traceability and "What-If" scenario simulations (e.g., *Key Family pays 15 days late*, *School holiday month pause*).
- **AI-Powered Cash Copilot & Message Parser**: Paste raw parent messages (e.g., *"Hi sir, paid 2400 for Rohan for Oct via GPay ref 928371"*), automatically parse and match students/amounts, and record payments in seconds. Works with **Google Gemini 1.5 Flash** or offline with local NLP fallback.
- **Zero-Setup Quickstart**: Works out of the box with zero external database dependencies using an embedded JSON persistence engine and a pre-loaded 12-family demo dataset.

---

## 🚀 Quick Start (Instant Run)

### Option 1: 1-Click Launch (Windows)
Double-click `start.bat` or run in PowerShell:
```powershell
.\start.ps1
```
This automatically boots both the backend API (port 3001) and frontend dev server (port 5173), then opens the web application in your browser.

---

### Option 2: Manual Terminal Launch

#### 1. Start the Backend API
```bash
cd backend
npm run dev
```
*API runs at `http://localhost:3001`.*

#### 2. Start the Frontend
```bash
cd frontend
npm run dev
```
*Web App runs at `http://localhost:5173` (with `/api` proxied to port 3001).*

---

### 🔑 1-Click Demo Login
When opening `http://localhost:5173`:
- Click the green **"Instant 1-Click Tutor Demo Sign-In"** button.
- You are instantly logged in as the demo tutor (**Sarah Jenkins**, Chemistry & Math Tutor) with 12 active student families, realistic invoice cycles, and an active cash forecast dip at Week 7.

---

## 🤖 AI Implementation & Dual-Path Resilience

Tutor Ledger includes an AI Assistant powered by Google Gemini, designed with offline resilience so that tutors can use the app even without an API key or internet access.

| Feature | Powered By | Gemini 1.5 Flash Online Mode | Offline Local NLP Fallback |
| :--- | :--- | :--- | :--- |
| **Payment Message Parsing** | `/api/ai/parse-payment` | Extracts student name, amount, payment method, reference, and flags ambiguous amounts. | Regex-based Indian/Global payment pattern recognition (UPI, GPay, Paytm, Bank Transfer, cash, currencies). |
| **WhatsApp Reminder Drafting** | `/api/reminders/draft` | Context-aware, personalized reminders in Gentle, Standard, or Firm tones matching tutor-parent history. | Template engine adhering strictly to spec FR-025, inserting family name, child name, amount due, and payment link. |
| **Cash Flow Financial Copilot** | `/api/ai/copilot-chat` | Natural language advisor answering queries like *"Will I make rent in Week 7?"* or *"Who owes me the most money right now?"*. | Rule-based financial diagnostics directly examining current cash balances, overdue invoices, and scenario dips. |

### Configuring Your Gemini API Key
To enable online Gemini 1.5 Flash model features:
1. Open `.env` (or `backend/.env`).
2. Add your key:
   ```env
   GEMINI_API_KEY="your-gemini-api-key-here"
   ```
*(If no key is supplied, Tutor Ledger automatically operates using the local fallback engine without errors).*

---

## 📂 Project Architecture

```
cb-project/
├── backend/                  # Fastify 5 + TypeScript REST API
│   ├── src/
│   │   ├── config/           # Environment variables, security secrets
│   │   ├── db/               # Dual-engine DB (PostgreSQL + JSON Store fallback)
│   │   ├── domain/           # Core business logic (AI Assistant, Alerts, Who Owes, Sample Data)
│   │   ├── http/             # Security middleware (AES-256-GCM, Rate Limiting, CSRF, Redaction)
│   │   ├── routes/           # REST endpoints (auth, invoices, families, payments, forecast, ai, etc.)
│   │   ├── app.ts            # Fastify application setup
│   │   └── server.ts         # Server entrypoint (Port 3001)
│   └── tests/                # Vitest test suite (36 unit tests)
│
├── frontend/                 # React 18 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── features/         # Feature views (Dashboard, Chase Today, Who Owes, Forecast, Scenarios, AI Copilot)
│   │   ├── services/api.ts   # Typed API client with auto-session refresh
│   │   ├── types.ts          # Domain TypeScript interfaces
│   │   ├── App.tsx           # App router and navigation shell
│   │   └── main.tsx          # React DOM bootstrap
│   └── vite.config.ts        # Vite configuration with /api reverse proxy
│
├── shared/forecast/          # Pure TypeScript 13-Week Cash Forecasting Engine
│   ├── src/
│   │   ├── money.ts          # Integer-cents arithmetic (avoids IEEE-754 floating point errors)
│   │   ├── forecast.ts       # 13-week deterministic cash forecast algorithm
│   │   └── scenarios.ts      # What-If projection deltas
│   └── tests/                # Pure mathematical test verification (4/4 passed)
│
├── specs/001-tutor-ledger/   # Detailed specifications & functional requirements
├── start.bat                 # 1-Click Windows Batch startup script
└── start.ps1                 # 1-Click PowerShell startup script
```

---

## 🧪 Testing & Verification

Run the full monorepo test suite:
```bash
npm test
```

### Verified Test Suites:
- `shared/forecast`: 4/4 passing (Pure deterministic 13-week rolling calculation, integer-cents arithmetic, scenario overlays).
- `backend`: 36/36 passing:
  - `ai-assistant.test.ts`: Gemini online parsing + offline fallback heuristics.
  - `never-auto-sent.test.ts`: Enforces spec rule FR-025 (no automated WhatsApp dispatch).
  - `parse-message-prefill.test.ts`: Payment prefill accuracy and multi-amount ambiguity flagging.
  - `field-encryption.test.ts`: AES-256-GCM at-rest encryption for parent names and phone numbers.
  - `log-redaction.test.ts`: Ensures PII is never leaked into server logs or error traces.
  - `csrf-origin.test.ts`: Validates origin check security.
  - `session-idle.test.ts`: Automatic session expiration on inactivity.
  - `login-lockout.test.ts`: Brute-force protection on authentication.

---

## 🔒 Compliance & Non-Negotiables
- **Zero Automated Dispatch**: All reminders open directly in the user's local WhatsApp client via `https://wa.me/<phone>?text=<encoded_draft>`. No silent external bot messages.
- **Privacy by Design**: Sensitive PII (parent names, phone numbers) is stored encrypted (`AES-256-GCM`) and masked in logs.
- **Pure Forecast Engine**: Zero external dependencies in `shared/forecast` ensuring 100% reproducible, auditable projections.
