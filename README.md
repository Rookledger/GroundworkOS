# GroundworkOS

**The OS for UK groundwork contractors.**

Manage jobs, CIS compliance, quotes, invoices, plant, subcontractors, timesheets and more — built specifically for the way UK groundwork companies operate.

---

## Stack

| Layer    | Technology                             |
| -------- | -------------------------------------- |
| Frontend | React 19 + Vite + Tailwind v4 + wouter |
| Backend  | Express v5 + TypeScript                |
| Database | PostgreSQL + Drizzle ORM               |
| Auth     | Clerk                                  |
| Monorepo | pnpm workspaces                        |
| Email    | Resend                                 |

---

## Features

- **Jobs** — full lifecycle from enquiry to completion, with progress tracking and site details
- **Quotes** — line-item quotes with PDF export and client email sending
- **Invoices** — CIS-aware invoicing with PDF export and accounting sync (Xero, QuickBooks, Sage, FreeAgent)
- **Schedule** — crew and plant scheduling calendar
- **Clients & Subcontractors** — full contact management with CIS verification status
- **Documents** — compliance document tracking with expiry alerts (RAMS, insurance, permits)
- **Plant** — fleet management with MOT, service and LOLER exam tracking
- **Timesheets** — daily time logging per job and worker
- **Purchase Orders** — supplier PO management with PDF export
- **Reports** — revenue overview, job P&L, CIS300 export, rate book
- **CIS300 Export** — CSV per tax month (including subcontractor UTR) formatted for manual HMRC filing
- **Audit Trail** — every create/update/delete recorded with full change history
- **Client Portal** — shareable quote approval links for clients
- **Accounting Integrations** — sync contacts, invoices and quotes, and pull payment status, with Xero, QuickBooks Online, Sage Accounting, or FreeAgent (self-service OAuth — the client connects with their own accounting login, no API keys required)
- **CSV Import** — bulk import clients and jobs from spreadsheet
- **Role-based access** — Admin / Manager / Foreman permission levels
- **Onboarding wizard** — guided company setup on first login

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database

### Environment Variables

Create a `.env` file in the project root (or set these as secrets in your host):

```env
# Core (required)
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@host:5432/groundworkos

# Clerk Auth (get from dashboard.clerk.com) — email-only sign-in;
# no Google or other social/OAuth sign-in is configured.
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# App settings (required)
APP_URL=https://your-app.example.com
BASE_PATH=/
STATIC_DIR=artifacts/groundworkos/dist/public

# Object storage — S3-compatible (required). S3_BUCKET, S3_ACCESS_KEY_ID
# and S3_SECRET_ACCESS_KEY throw at boot if unset; S3_REGION and
# S3_ENDPOINT silently default to AWS us-east-1 if unset, which is wrong
# for most providers, so set all five explicitly. Use AWS S3, Cloudflare
# R2, Backblaze B2, Oracle Cloud Object Storage, MinIO, etc. — Railway
# has no built-in object storage.
S3_BUCKET=groundworkos-files
S3_REGION=us-east-1
S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
S3_ACCESS_KEY_ID=your-s3-access-key
S3_SECRET_ACCESS_KEY=your-s3-secret-key
# S3_FORCE_PATH_STYLE=true    # optional, defaults to true (path-style addressing)
# S3_PUBLIC_PREFIX=public/    # optional, defaults to public/

# Logging (optional)
# LOG_LEVEL=info

# Sign-up restriction backstop (optional — on top of Clerk Dashboard →
# Configure → Restrictions, which is the primary control)
# CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
# SIGNUP_ALLOWED_EMAIL_DOMAINS=yourcompany.co.uk

# Email (optional — get from resend.com)
RESEND_API_KEY=re_...

# Xero (optional)
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_REDIRECT_URI=...

# QuickBooks Online (optional)
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_REDIRECT_URI=...

# Sage Accounting (optional)
SAGE_CLIENT_ID=...
SAGE_CLIENT_SECRET=...
SAGE_REDIRECT_URI=...

# FreeAgent (optional)
FREEAGENT_CLIENT_ID=...
FREEAGENT_CLIENT_SECRET=...
FREEAGENT_REDIRECT_URI=...
```

`PORT`, `DATABASE_URL`, the Clerk keys, `APP_URL`, `BASE_PATH`, `STATIC_DIR` and the five `S3_*` object storage variables are all required — the app will not build or boot correctly without them (`PORT` has no built-in fallback; Railway supplies it automatically, but self-hosted setups must set it). Everything below the object storage block (S3 addressing tweaks, logging, sign-up restriction, email, Xero, QuickBooks, Sage, FreeAgent) is optional. `NODE_ENV` isn't enforced at boot but should be set to `production` when self-hosting — it controls log formatting and is a hard safety check in the local demo-data seed script (`pnpm --filter @workspace/api-server run seed`, which also requires `SEED_CONFIRM_NON_LOCAL_DB=yes` to run against any non-localhost `DATABASE_URL`). On Railway, leave `NODE_ENV` unset: Railway supplies `NODE_ENV=production` automatically at runtime, and setting it as a build-time variable makes pnpm skip devDependencies — where `typescript`, `vite`, `esbuild` and `drizzle-kit` live — so the build fails. See **[RAILWAY.md](./RAILWAY.md)** for how these map to Railway service variables, and each accounting integration is optional and independent — set only the credentials for the providers this client actually uses. Every provider uses self-service OAuth: the client logs in with their own accounting software account and authorises access, so you never need to obtain or hold their accounting API keys.

### Install & Run

```bash
# Install all dependencies
pnpm install

# Push the database schema (Drizzle)
pnpm --filter @workspace/db run push

# Start development (frontend + API, in parallel)
pnpm -r --parallel run dev
```

Both the frontend dev server and the API server require `PORT` to be set (there's no built-in default) — e.g. `PORT=5173` for the frontend and `PORT=3001` for the API server when running them side by side locally.

---

## Project Structure

```
/
├── artifacts/
│   ├── groundworkos/        # React + Vite frontend
│   ├── api-server/          # Express API server
│   └── mockup-sandbox/      # UI mockup/design preview sandbox (not part of the deployed app)
├── lib/
│   ├── db/                  # Drizzle schema + migrations
│   ├── api-client-react/    # Typed API client (shared)
│   ├── api-spec/            # OpenAPI spec + codegen (orval)
│   ├── api-zod/             # Shared Zod schemas/types
│   ├── shared-role/         # Shared role types/logic (frontend + backend)
│   └── object-storage-web/  # File upload utilities
├── scripts/                 # Standalone scripts (workspace package)
└── pnpm-workspace.yaml
```

---

## User Roles

Sign-in is email-only (Clerk's email code / password flows) — no Google or other social/OAuth sign-in provider is enabled. GroundworkOS is invite-only by default; see `CLERK_WEBHOOK_SIGNING_SECRET` / `SIGNUP_ALLOWED_EMAIL_DOMAINS` above and the Clerk Dashboard's Restrictions setting.

Roles are stored in Clerk `publicMetadata.role`. Set via the **Settings → Users** page (admin only) or directly in the Clerk dashboard.

| Role      | Access                                                              |
| --------- | ------------------------------------------------------------------- |
| `admin`   | Full access including Users, Audit Log, Deploy Guide                |
| `manager` | All operational features: jobs, quotes, invoices, reports, settings |
| `foreman` | Dashboard, jobs, schedule, timesheets                               |

**First-time setup (bootstrap):** A user with no role set defaults to `foreman` — nobody, including the very first signup, ever gets `admin` automatically. The very first admin is created through a one-time, self-service bootstrap: while the workspace has zero admins, the **Settings → Users** page shows a "Make me admin" button for any signed-in user instead of the normal admin-only view. Clicking it calls `POST /api/admin/bootstrap`, which sets your own `publicMetadata.role` to `admin` — but only if no admin exists yet (checked server-side via `GET /api/admin/bootstrap-status`); once any account has `role: "admin"`, bootstrap permanently stops working and all further role changes must go through that admin's **Settings → Users** page. If you're locked out entirely (e.g. restoring from a backup with no admins left), you can also set `{ "role": "admin" }` on an account's Public metadata directly in the Clerk dashboard.

---

## First Login Checklist

1. Sign up via the app — you'll be assigned `foreman` role by default
2. Go to **Settings → Users** — since no admin exists yet, you'll see a "Make me admin" button; click it to bootstrap yourself as the first admin
3. Refresh the app — full sidebar now visible
4. Go to **Settings** and complete your company details (name, address, VAT number, bank details)
5. Invite any additional users and set their roles from **Settings → Users**
6. (Optional) Connect an accounting provider from **Settings → [Provider] Integration** (Xero, QuickBooks, Sage, or FreeAgent)
7. (Optional) Add `RESEND_API_KEY` secret to enable email sending for quotes and invoices

---

## Deployment

GroundworkOS is deployed on [Railway](https://railway.app) as a single service — the Express API server serves the built frontend directly (via `STATIC_DIR`), so no separate static host or reverse proxy is required.

See **[RAILWAY.md](./RAILWAY.md)** for the full step-by-step guide, covering the Railway project and PostgreSQL plugin setup, required environment variables (Clerk, database, object storage, app URL), the build and start commands already configured via `railway.json`, running database migrations with the Railway CLI, first login and setting the admin role, and custom domains and troubleshooting.

For self-hosting outside Railway (e.g. a VPS), see the in-app Deploy Guide (`/deploy`, admin only), which covers an Oracle Cloud + Nginx + PM2 setup instead.

---

## CIS Compliance

GroundworkOS is built around UK Construction Industry Scheme requirements:

- Subcontractor CIS status tracking (Gross / Net / Unmatched / Unverified)
- Automatic CIS deduction calculation on invoices
- Monthly CIS300 return export (CSV formatted for manual filing with HMRC — not an automated/API submission)
- Expiry tracking for CSCS cards, NRSWA certifications, public liability insurance

---

## Architecture & Development Notes

A few non-obvious design decisions and gotchas worth knowing before making changes:

**Roles & access control** — Roles live in Clerk `publicMetadata.role` and are read independently on the frontend (`hooks/useRole.ts`) and backend (`lib/auth.ts`, `admin.ts`); any change to role logic must be applied in all places at once, since a mismatch between frontend and backend checks has been a real bug source. A user with no role set defaults to `foreman` (the lowest-privilege role) — the very first admin is instead created via the one-time bootstrap flow (`POST /api/admin/bootstrap`, see the User Roles section above), a deliberate choice so a stranger reaching a public sign-up page never lands with elevated access. Any endpoint gated to admin (e.g. the audit trail) must have every consumer of that endpoint gated too, not just the page that owns it — the dashboard's "Recent Activity" panel reads the same audit endpoint as the full Audit Log page.

**API data shape** — The database and API layer use camelCase (Drizzle convention), while the frontend's `types.ts` uses snake_case throughout. The bridge between them lives in `artifacts/groundworkos/src/lib/apiTransforms.ts`, called from `artifacts/groundworkos/src/store/DataLoader.tsx`. Any new field added to the schema needs a matching entry in the transform layer or it won't reach the frontend.

**Data integrity rule** — Never persist a client-supplied id as a database primary key on create/edit endpoints; generate ids server-side instead. A shared default-form object that baked in a single client-generated id at module load time once caused every _second_ record of a given type to silently fail to save (a primary-key collision on the second insert). Client-side temporary ids should only ever be used as React keys, never sent to the database as the row's identity.

**UI loading state** — Pages read from a shared app-wide store that starts empty; a single loading gate in the main layout (driven by the core list queries: clients/jobs/quotes/invoices) blocks rendering until the first load completes, so no page can flash a false "no results" state. If a new top-level dataset becomes something a page depends on for its first paint, add it to that gate's condition.

**TypeScript route typing** — Any Express middleware factory meant to sit in front of a typed route handler (e.g. a role-check middleware) should be generic over the route's param/body/query types (`RequestHandler<P, ResBody, ReqBody, ReqQuery>`), not hardcoded to the base `Request`/`Response` types — otherwise TypeScript silently widens `req.params` for every handler in that route's chain.

**Design tokens** — The UI's "Technical Survey" theme (warm concrete background, Survey Blue `#1b5e78` accent, Space Grotesk/Inter/JetBrains Mono type) is defined as CSS variables in `index.css`. Reuse those tokens for new UI work rather than hardcoding new colors.

---

## License

Private — not open source. All rights reserved.
