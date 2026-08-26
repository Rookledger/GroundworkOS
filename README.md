# GroundworkOS

**The OS for UK groundwork contractors.**

Manage jobs, CIS compliance, quotes, invoices, plant, subcontractors, timesheets and more — built specifically for the way UK groundwork companies operate.

---

## Stack

| Layer          | Technology                                          |
| -------------- | ---------------------------------------------------- |
| Frontend       | React 19 + Vite + Tailwind v4 + wouter               |
| Backend        | Hono + TypeScript, on Cloudflare Workers             |
| Database       | Cloudflare D1 (SQLite) + Drizzle ORM                 |
| Object storage | Cloudflare R2 (RAMS PDFs, insurance certs, photos)   |
| Rate limiting  | Cloudflare KV (also OAuth CSRF state)                |
| Auth           | Clerk                                                |
| Monorepo       | pnpm workspaces                                      |
| Email          | Resend                                               |

The frontend deploys to Cloudflare Pages and the backend deploys as a separate Cloudflare Worker — there is no single combined process serving both, unlike the project's earlier Express/Railway architecture (see `RAILWAY.md`'s git history if you need the old setup for reference).

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

- Node.js 22+
- pnpm 9+
- A Cloudflare account (Workers, Pages, D1, R2 and KV are all used — see [Deployment](#deployment))
- The Wrangler CLI, `wrangler`, bundled as a devDependency of `artifacts/api-server` — run it via `pnpm exec wrangler ...` from that directory, no separate global install needed

### Environment Variables

Cloudflare Workers have no single `.env` file: **non-secret** values live as `vars` in `artifacts/api-server/wrangler.jsonc`, and **secrets** are set with `wrangler secret put <NAME>` (or, for local dev, a `.dev.vars` file in `artifacts/api-server` — see Wrangler's docs; that file is already gitignored). The frontend build is a separate concern again — Vite inlines its `VITE_*` variables into the built bundle, so those are set wherever you run `pnpm --filter @workspace/groundworkos run build` (a Cloudflare Pages project's build environment variables, in production).

Required (the Worker returns a 500 "Server misconfigured" on every request if any of these are missing or malformed — see `artifacts/api-server/src/lib/validateEnv.ts`):

```env
# App settings
APP_URL=https://your-app.example.com   # the frontend's origin — used for CORS and the CSP

# Clerk Auth (get from dashboard.clerk.com) — email-only sign-in;
# no Google or other social/OAuth sign-in is configured.
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

The frontend build additionally requires, as **build-time** variables (not read by the Worker at all):

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...   # MUST be the exact same value as CLERK_PUBLISHABLE_KEY above
BASE_PATH=/
```

`VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_PUBLISHABLE_KEY` must be identical — one is inlined into the frontend bundle by Vite, the other read by the Worker at runtime, and **nothing automatically keeps them in sync** (the Worker no longer checks this for you at boot; that check was dropped when the frontend and backend became separate deployments with no shared filesystem — double-check both values yourself before deploying).

Everything else is optional:

```env
# Sign-up restriction backstop (optional — on top of Clerk Dashboard →
# Configure → Restrictions, which is the primary control)
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
SIGNUP_ALLOWED_EMAIL_DOMAINS=yourcompany.co.uk

# Locks the first-admin bootstrap flow to one email address (see User Roles below)
BOOTSTRAP_ADMIN_EMAIL=owner@yourcompany.co.uk

# Email (get from resend.com)
RESEND_API_KEY=re_...

# Xero
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_REDIRECT_URI=...

# QuickBooks Online
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_REDIRECT_URI=...

# Sage Accounting
SAGE_CLIENT_ID=...
SAGE_CLIENT_SECRET=...
SAGE_REDIRECT_URI=...

# FreeAgent
FREEAGENT_CLIENT_ID=...
FREEAGENT_CLIENT_SECRET=...
FREEAGENT_REDIRECT_URI=...
```

Each accounting integration is optional and independent — set only the credentials for the providers this client actually uses. Every provider uses self-service OAuth: the client logs in with their own accounting software account and authorises access, so you never need to obtain or hold their accounting API keys. See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for exactly which of the above go in `wrangler.jsonc`'s `vars`, which go via `wrangler secret put`, and which are Cloudflare Pages build variables.

### Install & Run

```bash
# Install all dependencies
pnpm install

# Apply the D1 schema to a local (SQLite-backed) database for `wrangler dev`
cd artifacts/api-server
pnpm exec wrangler d1 migrations apply groundworkos --local
cd ../..

# Start development (frontend + API, in parallel)
pnpm -r --parallel run dev
```

This starts two independent dev servers: `wrangler dev` for the API (`artifacts/api-server`, defaults to `http://localhost:8787`) and Vite for the frontend (`artifacts/groundworkos`, requires a `PORT` env var — e.g. `PORT=5173`). The frontend's API calls are relative paths (`/api/...`), so the two aren't wired together out of the box the way a single combined process would be — either add a Vite dev proxy forwarding `/api` to the wrangler dev server, or exercise the two independently (e.g. hit the API directly with `curl`/an HTTP client while iterating on it).

Local dev also needs `artifacts/api-server/.dev.vars` set with at least `APP_URL`, `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (see Environment Variables above) — `wrangler dev` reads that file automatically and it's already gitignored.

---

## Project Structure

```
/
├── artifacts/
│   ├── groundworkos/        # React + Vite frontend (deploys to Cloudflare Pages)
│   ├── api-server/          # Hono API server (deploys as a Cloudflare Worker; wrangler.jsonc, D1/R2/KV bindings)
│   └── mockup-sandbox/      # UI mockup/design preview sandbox (not part of the deployed app)
├── lib/
│   ├── db/                  # Drizzle schema + D1 migrations (SQL, generated by drizzle-kit)
│   ├── api-client-react/    # Typed API client (shared)
│   ├── api-spec/            # OpenAPI spec + codegen (orval)
│   ├── api-zod/             # Shared Zod schemas/types
│   ├── shared-role/         # Shared role types/logic (frontend + backend)
│   └── object-storage-web/  # File upload utilities
├── scripts/                 # Standalone scripts (workspace package)
└── pnpm-workspace.yaml
```

---

## Testing

- `pnpm run test` — unit tests (plain Node/vitest). Each router is mounted stand-alone with a fake D1/Clerk/logger injected via `c.set(...)`, so these never touch a real database.
- `pnpm run test:integration` — `@workspace/api-server`'s integration suite, which runs each router against a **real local D1 database inside an actual Workers runtime** (Miniflare/workerd, via `@cloudflare/vitest-pool-workers` — see `artifacts/api-server/vitest.integration.config.ts`). Migrations from `lib/db/migrations` are applied automatically before the suite runs; no external database or seed step is required. This replaces the project's earlier Postgres-backed integration suite.

Both run in CI (`.github/workflows/ci.yml`) on every push and PR, alongside `pnpm run typecheck` and `pnpm run lint`.

---

## User Roles

Sign-in is email-only (Clerk's email code / password flows) — no Google or other social/OAuth sign-in provider is enabled. GroundworkOS is invite-only by default; see `CLERK_WEBHOOK_SIGNING_SECRET` / `SIGNUP_ALLOWED_EMAIL_DOMAINS` above and the Clerk Dashboard's Restrictions setting.

Roles are stored in Clerk `publicMetadata.role`. Set via the **Settings → Users** page (admin only) or directly in the Clerk dashboard.

| Role      | Access                                                              |
| --------- | --------------------------------------------------------------------- |
| `admin`   | Full access including Users, Audit Log, Deploy Guide                |
| `manager` | All operational features: jobs, quotes, invoices, reports, settings |
| `foreman` | Dashboard, jobs, schedule, timesheets                               |

**First-time setup (bootstrap):** A user with no role set defaults to `foreman`. The very first admin is created automatically: while the workspace has zero admins, the first non-admin who opens **Settings → Users** is promoted to `admin` the moment that page checks `GET /api/admin/bootstrap-status` — no button click required, the page just reloads itself once the promotion lands. `POST /api/admin/bootstrap` still exists and does the same promotion on demand, so a manual "Make me admin" button remains as a fallback for the rare case the automatic path doesn't apply to you (e.g. `BOOTSTRAP_ADMIN_EMAIL` is set to someone else). Either path only succeeds while no admin exists yet; once any account has `role: "admin"`, bootstrap permanently stops working and all further role changes must go through that admin's **Settings → Users** page. Because this now happens automatically instead of behind an explicit click, `BOOTSTRAP_ADMIN_EMAIL` (see above) matters more on any workspace that might be reachable before you've had a chance to sign up — without it, whoever opens Settings → Users first claims admin. If you're locked out entirely (e.g. restoring from a backup with no admins left), you can also set `{ "role": "admin" }` on an account's Public metadata directly in the Clerk dashboard.

---

## First Login Checklist

1. Sign up via the app — you'll be assigned `foreman` role by default
2. Go to **Settings → Users** — since you're the first user, this page auto-promotes you to admin and reloads itself; if you land on a "Make me admin" button instead, click it to bootstrap yourself manually
3. Refresh the app — full sidebar now visible
4. Go to **Settings** and complete your company details (name, address, VAT number, bank details)
5. Invite any additional users and set their roles from **Settings → Users**
6. (Optional) Connect an accounting provider from **Settings → [Provider] Integration** (Xero, QuickBooks, Sage, or FreeAgent)
7. (Optional) Set the `RESEND_API_KEY` secret to enable email sending for quotes and invoices

---

## Deployment

GroundworkOS deploys as two separate Cloudflare projects: the frontend as a **Cloudflare Pages** static site, and the API as a **Cloudflare Worker** (Hono) backed by **D1** (database), **R2** (file storage) and **KV** (rate limiting / OAuth state) bindings. The two are wired together in production by binding a Worker Route for `/api/*` on the same domain the Pages project serves — the frontend calls relative `/api/...` paths, so this keeps everything same-origin.

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full step-by-step guide: provisioning D1/R2/KV, applying migrations, setting `wrangler.jsonc` vars vs. `wrangler secret put` secrets vs. Pages build variables, deploying both projects, binding the `/api/*` route, first login and the admin bootstrap flow, and troubleshooting.

The in-app Deploy Guide (`/deploy`, admin only) predates this Cloudflare migration and still describes the old Postgres/VPS setup — use DEPLOYMENT.md instead until that page is rewritten.

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

**Roles & access control** — Roles live in Clerk `publicMetadata.role` and are read independently on the frontend (`hooks/useRole.ts`) and backend (`lib/auth.ts`, `admin.ts`); any change to role logic must be applied in all places at once, since a mismatch between frontend and backend checks has been a real bug source. A user with no role set defaults to `foreman` (the lowest-privilege role) — the very first admin is instead created via the bootstrap flow (`GET /api/admin/bootstrap-status`, run automatically the first time a non-admin opens Settings → Users on an admin-less workspace, and `POST /api/admin/bootstrap` for the manual "Make me admin" button; see the User Roles section above), a deliberate choice so a stranger reaching a public sign-up page never lands with elevated access just by virtue of an unset role. Any endpoint gated to admin (e.g. the audit trail) must have every consumer of that endpoint gated too, not just the page that owns it — the dashboard's "Recent Activity" panel reads the same audit endpoint as the full Audit Log page.

**API data shape** — The database and API layer use camelCase (Drizzle convention), while the frontend's `types.ts` uses snake_case throughout. The bridge between them lives in `artifacts/groundworkos/src/lib/apiTransforms.ts`, called from `artifacts/groundworkos/src/store/DataLoader.tsx`. Any new field added to the schema needs a matching entry in the transform layer or it won't reach the frontend.

**Data integrity rule** — Never persist a client-supplied id as a database primary key on create/edit endpoints; generate ids server-side instead (`generateId()` in `lib/generateId.ts`, `crypto.randomUUID()`). A shared default-form object that baked in a single client-generated id at module load time once caused every _second_ record of a given type to silently fail to save (a primary-key collision on the second insert). Client-side temporary ids should only ever be used as React keys, never sent to the database as the row's identity.

**UI loading state** — Pages read from a shared app-wide store that starts empty; a single loading gate in the main layout (driven by the core list queries: clients/jobs/quotes/invoices) blocks rendering until the first load completes, so no page can flash a false "no results" state. If a new top-level dataset becomes something a page depends on for its first paint, add it to that gate's condition.

**No module-level singletons on the backend** — Workers have no long-lived process: `c.env` (D1/R2/KV bindings, vars, secrets) only exists for the lifetime of one request. There is no module-level `db`, `logger`-with-baked-in-config, or in-memory `Map` that survives across requests the way the old Express server had — every route reads `c.get("db")` / `c.get("logger")` (set per-request by middleware in `app.ts`) instead, and state that needs to persist across requests (rate-limit counters, OAuth CSRF tokens) lives in KV, not a module-level Map.

**Hono middleware typing** — Any middleware factory meant to sit in front of a typed route handler (e.g. `requireRole` in `lib/auth.ts`) should be typed `MiddlewareHandler<AppEnv>` (see `types.ts` for `AppEnv`'s `Bindings`/`Variables`), not a bare untyped handler — otherwise `c.env`/`c.get(...)` lose their types for every handler in that route's chain.

**Design tokens** — The UI's "Technical Survey" theme (warm concrete background, Survey Blue `#1b5e78` accent, Space Grotesk/Inter/JetBrains Mono type) is defined as CSS variables in `index.css`. Reuse those tokens for new UI work rather than hardcoding new colors.

---

## License

Private — not open source. All rights reserved.
