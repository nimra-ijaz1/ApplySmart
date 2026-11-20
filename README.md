# ApplySmart — International University Application Platform

ApplySmart is a full-stack SaaS web application built to help students — with specialized support for Pakistani applicants targeting Bachelor's, Master's, and PhD degrees abroad — research universities, run deterministic eligibility checks, discover verified scholarships, manage application documents, track deadlines, and get grounded AI guidance in one workspace.

---

## Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, TanStack Query v5, React Hook Form, Zod, Recharts, Lucide Icons, Sonner
- **Backend**: Node.js 22+, Express (`server.ts`), Drizzle ORM (`pg` driver), Multer + `pdf-parse` v2 for PDF text extraction, `express-rate-limit`
- **Database**: PostgreSQL (Cloud SQL) with 21 relational tables managed via Drizzle ORM (`src/db/schema.ts`)
- **Authentication & RBAC**: Firebase Authentication (Email/Password, Google Sign-In, Password Reset) verified server-side via `firebase-admin`, with PostgreSQL-backed `student`, `admin`, and `super_admin` roles
- **AI Engine**: `@google/genai` server-side integration (`src/server/services/aiService.ts`) strictly grounded in student profile records, database catalog facts, and extracted PDF text

---

## Environment Variables

Configure secrets in your runtime environment (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side Gemini API key (never exposed to browser) |
| `APP_URL` | Deployed application base URL |
| `SQL_HOST` | Cloud SQL / PostgreSQL host |
| `SQL_DB_NAME` | PostgreSQL database name |
| `SQL_USER` | PostgreSQL application user |
| `SQL_PASSWORD` | PostgreSQL application password |
| `SQL_ADMIN_USER` | PostgreSQL admin user for schema push |
| `SQL_ADMIN_PASSWORD` | PostgreSQL admin password |

Firebase Web & Admin configuration is read from `/firebase-applet-config.json`.

---

## Local Development & Scripts

```bash
# Install dependencies
npm install

# Run full-stack development server (Express + Vite on port 3000)
npm run dev

# Type-check codebase
npm run lint

# Run automated unit tests
npm test

# Build frontend for production
npm run build

# Start production Node.js server
npm start
```

---

## Core API Endpoints

### Public
- `GET /api/health` — Service health probe
- `GET /api/public/stats` — Live catalog counts (auto-seeds verified catalog if empty)
- `POST /api/public/contact` — Submit inquiry to `contact_inquiries`
- `GET /api/universities` & `GET /api/universities/:id` — Searchable university catalog & 8-section university details
- `GET /api/programmes` & `GET /api/programmes/:id` — Programme filtering, comparison, and entry requirements
- `GET /api/scholarships` & `GET /api/scholarships/:id` — Scholarship catalog & eligibility criteria

### Authenticated Student Workspace
- `GET /api/profile`, `PUT /api/profile`, `POST /api/onboarding/complete`, `DELETE /api/account`
- `GET /api/dashboard` — Dynamic KPI counts, application chart breakdown, upcoming deadlines, missing docs
- `GET /api/shortlist`, `POST /api/shortlist`, `DELETE /api/shortlist/:id`
- `POST /api/eligibility/check`, `GET /api/eligibility/history` — Deterministic rule engine + optional AI plain-English explanation
- `GET /api/applications`, `POST /api/applications`, `GET /api/applications/:id`, `PUT /api/applications/:id`, `POST /api/applications/:id/documents`
- `GET /api/documents`, `POST /api/documents`, `DELETE /api/documents/:id` — Private document uploads + PDF text extraction
- `GET /api/reminders`, `POST /api/reminders`, `PUT /api/reminders/:id`, `DELETE /api/reminders/:id`
- `POST /api/ai/chat`, `GET /api/ai/conversations`, `POST /api/ai/extract-requirements` — Rate-limited AI assistant & admission PDF parser

### Admin & Super Admin (`/api/admin/*`)
- `GET /api/admin/overview`
- `POST/PUT/DELETE /api/admin/universities`, `POST/DELETE /api/admin/programmes`, `POST/DELETE /api/admin/scholarships`
- `POST /api/admin/import-csv` — Batch CSV university import into verification queue
- `GET /api/admin/verification` & `PUT /api/admin/verification/:entityType/:id`
- `GET /api/admin/users` & `PUT /api/admin/users/:id`
- `GET /api/admin/audit-logs` & `GET/PUT /api/admin/settings` (`super_admin`)

---

## Deterministic Eligibility Engine Rules

The eligibility engine (`src/server/services/eligibilityEngine.ts`) never guesses or hallucinates eligibility:
1. Missing academic CGPA/percentage or missing English test scores return `insufficient_information`.
2. Direct percentage-to-CGPA auto-conversion is never applied unless an institutional rule is configured; scale mismatches return `needs_manual_verification`.
3. Expired language tests (past `languageTestValidityDate`) fail deterministically.
4. IELTS overall **and** individual listening/reading/writing/speaking bands are checked separately.
