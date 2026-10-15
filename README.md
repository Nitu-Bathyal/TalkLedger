# TalkLedger 🎙️📒

> **“Speak naturally. Track every balance.”**  
> A voice-first digital credit and payment ledger designed specifically for small businesses such as grocery kirana shops, tailors, tutors, mechanics, and tiffin services.

TalkLedger transforms traditional paper *bahi-khata* bookkeeping into a fast, intuitive, voice-assisted full-stack digital ledger with authentic notebook styling, Indian Rupee (₹) currency formatting, and paise-precision financial accounting.

---

## 📑 Table of Contents
1. [Approved Visual Design & Brand](#-approved-visual-design--brand)
2. [Key Features](#-key-features)
3. [Architecture & Technology Stack](#-architecture--technology-stack)
4. [Financial Engine & Ledger Rules](#-financial-engine--ledger-rules)
5. [Voice & AI Extraction Layer](#-voice--ai-extraction-layer)
6. [Database Schema & Migrations](#-database-schema--migrations)
7. [Installation & Setup](#-installation--setup)
8. [Available Commands](#-available-commands)
9. [API Reference](#-api-reference)
10. [Automated Testing](#-automated-testing)
11. [Security & Data Isolation](#-security--data-isolation)
12. [Limitations & Future Roadmap](#-limitations--future-roadmap)

---

## 🎨 Approved Visual Design & Brand

TalkLedger preserves the warm, accessible, notebook-inspired visual personality from the approved prototype:
- **Palette**: Cream/off-white background (`#FFF8EA`) with subtle dotted bahi-khata texture, Deep Leaf Green (`#176B45`) for primary actions and payments, Haldi Yellow (`#FFC857`) for voice and highlights, Tomato Red (`#E96850`) for credit outstanding, and Ink Brown (`#342B25`) for crisp contrast.
- **Neo-Brutalist Bahi Shadows**: Distinct `boxShadow: 3px 4px 0px 0px #342B25` borders and shadow offsets evoking traditional Indian ledger notebooks.
- **Notebook Margins & Ruled Lines**: Notebook red margin lines (`#F3A193`) and clean ruled transaction registers.
- **Typography**: Clean, highly legible sans-serif (`Plus Jakarta Sans`) combined with warm handwritten annotations (`Caveat`).
- **Language**: English-first interface labels, notifications, and error messages paired with Indian number formatting (`en-IN`, ₹).

---

## 🚀 Key Features

1. **Live Dashboard**:
   - Total Outstanding Credit calculated dynamically from real ledger entries.
   - Total Payments Collected and 7-day collection recovery trends.
   - Number of active customers and overdue due-date reminders.
   - Interactive 7-Day Weekly Collections bar chart with hover values.
   - Recent transaction feed with one-click filtering (All, Credit, Payments) and search.

2. **Customer Management**:
   - Add, edit, and search customers by full name or mobile number.
   - Filter by status (`All`, `Has Credit`, `Settled`).
   - Accidental duplicate customer prevention.
   - Individual customer ledger view with complete transaction history.

3. **Voice-First Transaction Entry**:
   - Real browser **Web Speech API** integration with animated sound-bars and wave rings.
   - Full support for natural spoken sentences:
     - *"Aarav Sharma purchased supplies worth ₹340."*
     - *"Record payment of 500 rupees from Ramesh Kumar via UPI."*
     - *"Anita Tailor received fabric worth ₹850 on credit."*
     - *"Ramesh Kumar owes 500 rupees and will pay next Friday."*
   - Offline text-input fallback for browsers without speech recognition.
   - **Confirmation Preview**: Transactions are *never* written directly to the database without explicit user review and confirmation.
   - Ambiguity detection: Flags unknown customer names, missing amounts, or ambiguous transaction types.

4. **Polite Payment Reminders**:
   - Generates customized, respectful WhatsApp/SMS messages containing exact balance, customer name, and UPI ID (`sharmastore@upi`).
   - One-click copy to clipboard with instant toast feedback.
   - Direct `wa.me` shortcut button.

5. **Financial Reversals & Audit Trail**:
   - Immutable financial history: posted transactions are reversed with an audited reason rather than silently deleted.
   - Full tracking in `AuditLog` table.

6. **Reports & Data Export**:
   - Filter transactions by date range, customer, and type.
   - One-click export to CSV spreadsheet.

---

## 🏗️ Architecture & Technology Stack

The project is structured cleanly with separate client and server applications sharing domain types:

```
talkledger/
├── client/                     # Frontend (React 18, Vite, TypeScript, Tailwind CSS)
│   ├── src/
│   │   ├── components/         # Navbar, Dashboard, Voice, Ledger, Payments, Reports, Modals, Toast
│   │   ├── services/api.ts     # Typed fetch client for backend endpoints
│   │   ├── shared/             # Domain types, Zod schemas, currency utilities
│   │   ├── App.tsx             # Root application orchestrator
│   │   └── main.tsx            # DOM mounting
│   ├── package.json
│   └── vite.config.ts          # Configured with proxy to server (:3001)
│
├── server/                     # Backend (Node.js, Express, TypeScript, Prisma, SQLite)
│   ├── src/
│   │   ├── config.ts           # Environment variables configuration
│   │   ├── db.ts               # PrismaClient instance
│   │   ├── middleware/         # Auth, Zod validation, Centralized Error Handler
│   │   ├── routes/             # Auth, Customers, Transactions, Dashboard, Voice
│   │   ├── services/           # Customer, Transaction, Dashboard, VoiceParser
│   │   └── utils/currency.ts   # Integer paise arithmetic and INR formatting
│   ├── prisma/
│   │   ├── schema.prisma       # SQLite database schema
│   │   └── seed.ts             # Realistic Indian small-business seed script
│   ├── tests/                  # Automated integration tests (Vitest + Supertest)
│   └── package.json
│
├── shared/                     # Canonical shared types and Zod schemas
├── prototype_reference.html    # Original approved HTML prototype
├── package.json                # Monorepo runner scripts (concurrently)
└── README.md
```

---

## 💰 Financial Engine & Ledger Rules

TalkLedger eliminates floating-point rounding errors common in standard JavaScript:
- **Integer Paise Storage**: All financial amounts are stored as integer **paise** ($1\text{ Rupee} = 100\text{ paise}$). A transaction of ₹340.00 is stored as `34000`.
- **Derived Balances**: Balances are calculated dynamically using `SUM(CREDIT) - SUM(PAYMENT)` over active non-reversed entries. This prevents inconsistent or desynchronized cache totals.
- **Strict Validation**: Zero and negative amounts are rejected with 400 Bad Request.
- **Overpayment Guard**: Payments exceeding a customer's outstanding balance are rejected unless explicitly authorized as an advance payment.
- **Database Transactions**: All financial mutations run inside atomic `prisma.$transaction` blocks.

---

## 🎙️ Voice & AI Extraction Layer

The voice-entry service is decoupled into a replaceable architecture:
1. **Speech-to-Text**: Captures spoken English, Hindi, or Hinglish via the browser's native `SpeechRecognition` API.
2. **Text Fallback**: If the microphone is unavailable, users can type natural phrases into the quick-parse box.
3. **Extraction Engine (`/api/voice/parse`)**:
   - **Built-in Offline Rule Engine**: Regex entity matching, number-word parsing ("five hundred", "one thousand two hundred"), date resolution ("tomorrow", "next Friday", "15 Oct"), and fuzzy candidate matching against the user's registered customer database.
   - **Optional Gemini LLM Integration**: If a `GEMINI_API_KEY` is provided in `.env`, the parser utilizes Google Gemini 1.5/2.0 with structured JSON output, falling back gracefully to the offline rule engine if network issues occur.
4. **Editable Confirmation Preview**: Presents the extracted customer, amount, transaction type, due date, and description. The merchant verifies or edits the fields before explicitly clicking *"Confirm & Save"*.

---

## 🗄️ Database Schema & Migrations

The SQLite database (`dev.db`) contains the following entities:

- **`User`**: Store owner account (`id`, `email`, `passwordHash`, `businessName`, `phone`, `upiId`, `createdAt`).
- **`Customer`**: Customers scoped to the user (`id`, `userId`, `name`, `phone`, `notes`, `createdAt`).
- **`Transaction`**: Immutable ledger records (`id`, `userId`, `customerId`, `type`: `CREDIT` | `PAYMENT`, `amountPaise`, `description`, `paymentMode`: `CASH` | `UPI` | `BANK_TRANSFER`, `transactionDate`, `dueDate`, `source`: `MANUAL` | `VOICE`, `reversedAt`, `reversalReason`).
- **`AuditLog`**: System actions (`id`, `userId`, `action`, `entityType`, `entityId`, `details`, `createdAt`).

---

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18 or higher; tested on v24.16.0)
- npm (v9 or higher; tested on v11.13.0)

### 1. Clone & Install Dependencies
From the project root:
```bash
# Install root, server, and client dependencies
npm install
npm --prefix server install
npm --prefix client install
```

### 2. Configure Environment Variables
Copy `.env.example` to `server/.env`:
```bash
cp server/.env.example server/.env
```
Default `.env` settings:
```ini
PORT=3001
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET="talkledger-development-secret-jwt-key-32chars"
CORS_ORIGIN="http://localhost:5173"
GEMINI_API_KEY="" # Optional
```

### 3. Initialize & Seed Database
```bash
# Push Prisma schema to SQLite
npm run db:push

# Generate Prisma client
npm run db:generate

# Seed with authentic small business sample data
npm run db:seed
```

### 4. Start the Application
Run both server and frontend concurrently:
```bash
npm run dev
```
- Frontend will open at: **http://localhost:5173**
- Backend API will run at: **http://localhost:3001**
- API Health check: **http://localhost:3001/api/health**

---

## 🛠️ Available Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start both server and client concurrently with hot reload |
| `npm run dev:server` | Start backend with `tsx watch` on port 3001 |
| `npm run dev:client` | Start frontend with `vite` on port 5173 |
| `npm run build` | Compile TypeScript and build production bundles for server and client |
| `npm test` | Run all 18 automated ledger and voice parser tests (Vitest) |
| `npm run db:push` | Synchronize Prisma schema with local SQLite database |
| `npm run db:seed` | Seed database with demo customers and transactions |

---

## 📡 API Reference

All protected endpoints accept an optional `Authorization: Bearer <token>` header. If omitted in development mode, requests are automatically scoped to the default owner account (`owner@talkledger.local`).

### Health & Dashboard
- `GET /api/health` — Public health check.
- `GET /api/dashboard` — Aggregated real-time ledger metrics, 7-day collections, and recent entries.

### Customers
- `GET /api/customers?search=&filter=` — List customers with calculated balances.
- `POST /api/customers` — Create a new customer (validates duplicate names).
- `GET /api/customers/:id` — Customer profile with full ledger history.
- `PATCH /api/customers/:id` — Update customer phone, name, or notes.
- `GET /api/customers/:id/transactions` — All transactions for a specific customer.

### Transactions
- `GET /api/transactions?customerId=&type=&startDate=&endDate=` — Filtered transaction list.
- `POST /api/transactions` — Create Credit or Payment ledger entry.
- `GET /api/transactions/:id` — Retrieve a single transaction record.
- `POST /api/transactions/:id/reverse` — Reverse a financial entry with an audit reason.

### Voice Entry
- `POST /api/voice/parse` — Extract structured financial data from a spoken transcript.

---

## 🧪 Automated Testing

TalkLedger includes an extensive test suite executed with Vitest and Supertest:
```bash
npm test
```

### Test Coverage Highlights:
- **Paise Integer Arithmetic**: Rupee-to-paise conversion, floating-point prevention, and Indian currency formatting.
- **Customer CRUD**: Customer creation, name duplication rejection, notes update.
- **Credit Transactions**: Balance increment verification.
- **Payment Transactions**: Balance decrement and overpayment rejection policy.
- **Transaction Reversal**: Verification of audit trail and balance restoration.
- **Voice Parser**: Credit extraction, payment extraction, relative date resolution ("next Friday"), and ambiguity handling for missing amounts.
- **User Isolation**: Verification that User A cannot view User B's records.

**Status: 18 / 18 tests passing.**

---

## 🔒 Security & Data Isolation

- **Password Hashing**: User passwords hashed using `bcryptjs` with salt rounds.
- **Token Security**: Stateless JWTs with expiration for API authorization.
- **Multi-Tenant Isolation**: Every database query explicitly checks `userId`.
- **Parameterized SQL**: All database operations run through Prisma ORM, preventing SQL injection vulnerabilities.
- **No Stack Traces**: Centralized error middleware ensures clean, non-sensitive client error messages.

---

## 🔮 Limitations & Future Roadmap

- **Database**: SQLite is configured for simple local development and single-server deployments. For multi-instance cloud deployments with concurrent write scalability, update the Prisma provider to PostgreSQL.
- **WhatsApp Cloud API**: Currently provides 1-click clipboard copy and `wa.me` links. Future versions can connect to official Meta WhatsApp Cloud API webhooks for automated messaging.
- **Embedded Speech Models**: The Web Speech API and text fallback work out-of-the-box in modern browsers. An offline WebAssembly/ONNX Whisper model can be plugged into the voice interface for full offline speech recognition.

---

## 📄 License
MIT © 2026 TalkLedger Team. Designed with ❤️ for small business owners.
