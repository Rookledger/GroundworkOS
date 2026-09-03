# GroundworkOS — Technical Debt Audit

**Date:** 2026-09-03
**Scope:** Full pnpm monorepo (`lib/*`, `artifacts/*`) at commit `cbee647` ("Merge pull request #48… Remove leftover Railway references")

## Methodology

Explored the repository directly: README.md, DEPLOYMENT.md, `eslint.config.js`, `tsconfig.base.json` and per-package tsconfigs, `.github/workflows/ci.yml` and `deploy.yml`, `pnpm-workspace.yaml`, all `package.json` files, `lib/db/migrations`, and source under `lib/*` and `artifacts/*`. Findings were checked with `grep`, `wc -l`, `diff`, and `pnpm outdated` rather than inferred — each item below cites the file paths or command output it's based on. Git history in this clone is a single squashed commit, so commit-log mining wasn't possible; where a past incident is cited, it's because the repo's own docs describe it.

## Prioritization framework

Each item is scored Impact (1–5), Risk (1–5), and Effort (1–5, where lower = easier to fix). Priority = (Impact + Risk) × (6 − Effort).

## Findings, by priority

| # | Finding | Category | Impact | Risk | Effort | Priority |
|---|---|---|---|---|---|---|
| 1 | Test files excluded from typechecking | Infra/Test | 3 | 3 | 1 | 30 |
| 2 | Admin-bootstrap privilege-escalation race | Architecture/Security | 4 | 3 | 2 | 28 |
| 3 | Zero test coverage on critical/public backend routes | Test | 5 | 4 | 3 | 27 |
| 4 | No frontend test infrastructure | Test | 4 | 4 | 3 | 24 |
| 5 | No automated Worker deploy; caused a real incident | Infra | 4 | 4 | 3 | 24 |
| 6 | `no-explicit-any` disabled; 75 usages | Code quality | 3 | 3 | 2 | 24 |
| 7 | In-app Deploy Guide is stale and misleading | Documentation | 3 | 3 | 2 | 24 |
| 8 | Dead Clerk references survive auth migration | Code/Infra hygiene | 2 | 2 | 1 | 20 |
| 9 | Inconsistent `@cloudflare/workers-types` pin | Dependency | 2 | 2 | 1 | 20 |
| 10 | `strictFunctionTypes`/`noImplicitOverride` disabled | Code quality/Config | 2 | 2 | 1 | 20 |
| 11 | No CONTRIBUTING.md, ADRs, or runbooks | Documentation | 2 | 2 | 2 | 16 |
| 12 | `noUnusedLocals` off; ESLint only warns | Code quality | 2 | 1 | 1 | 15 |
| 13 | Runtime UI deps filed as devDependencies | Dependency hygiene | 2 | 1 | 1 | 15 |
| 14 | 15 of 18 page components are 700–1,700+ line "God components" | Architecture/Code | 4 | 3 | 4 | 14 |
| 15 | `mockup-sandbox` carries a drifted, forked UI kit | Dependency/Architecture | 1 | 1 | 2 | 8 |

## Detail

### 1. Test files are silently excluded from typechecking — Priority 30
Both `artifacts/api-server/tsconfig.json` and `artifacts/groundworkos/tsconfig.json` exclude `**/*.test.ts`. `pnpm run typecheck` (run in CI) never typechecks any of the 22 test files, including all 13 integration tests. A type error introduced only inside a test can pass CI indefinitely.

### 2. Admin-bootstrap privilege-escalation race — Priority 28
README.md and DEPLOYMENT.md both document that on an admin-less workspace, whoever opens Settings → Users first can bootstrap themselves to admin automatically, mitigated only by an optional `BOOTSTRAP_ADMIN_EMAIL`. `GET /api/admin/bootstrap-status` performs the promotion as a side effect of a GET request.

### 3. Business-critical and public-facing routes have zero test coverage — Priority 27
Of 26 files in `artifacts/api-server/src/routes/`, only 13 have a matching `*.integration.test.ts`. Untested: `cis.ts` (HMRC CIS300 compliance — the product's core regulatory feature), `portal.ts` (public, unauthenticated client-facing links), `storage.ts` (R2 uploads), `audit.ts`, `dashboard.ts`, `email.ts`, and all four accounting-OAuth routes (`xero.ts`, `quickbooks.ts`, `sage.ts`, `freeagent.ts`) plus their provider clients — 2,329 combined lines of OAuth/financial-sync logic with zero tests.

### 4. Frontend has effectively no test coverage or infrastructure — Priority 24
Only 1 of 101 non-test frontend source files has a test (`apiTransforms.test.ts`), covering 0 of 18 page components. `vitest.config.ts` uses `environment: "node"` with no `@testing-library/react` or jsdom dependency anywhere — a new `.tsx` test would have no DOM to run in.

### 5. No automated deploy for the API Worker; already caused an incident — Priority 24
`deploy.yml` is `workflow_dispatch`-only. DEPLOYMENT.md states the Worker doesn't redeploy on push and that D1 migrations need a manual `wrangler d1 migrations apply --remote` afterward. DEPLOYMENT.md also documents a real incident: a commit briefly pointed D1/KV bindings at a nonexistent `ktr-groundworks` database/namespace, confirmed in the dashboard on 2026-08-28 and since reverted. The frontend auto-deploys via Cloudflare Pages while the backend needs two manual steps remembered per release — an asymmetry that produced exactly this drift.

### 6. `no-explicit-any` disabled; 75 usages — Priority 24
`eslint.config.js` sets `@typescript-eslint/no-explicit-any: "off"`. 75 `any` usages are scattered across `lib/`, `artifacts/api-server/src`, and `artifacts/groundworkos/src`, concentrated in `apiTransforms.test.ts` (13), `email.ts` (8), `ReportsPage.tsx` (5), `PurchaseOrdersPage.tsx` (4), with 1–3 in most other page components.

### 7. In-app "Deploy Guide" is stale and actively misleading — Priority 24
README.md states the in-app `/deploy` admin page "predates this Cloudflare migration and still describes the old Postgres/VPS setup." It's a live, admin-facing page giving wrong operational instructions for the current architecture.

### 8. Dead Clerk references survive the Better-Auth migration — Priority 20
`ci.yml:52` still sets `VITE_CLERK_PUBLISHABLE_KEY: pk_test_dummy-key-for-ci-build` for a provider no longer used (auth is Better Auth only, per README). Stale Clerk comments remain in `app.ts:94`, `validateEnv.ts:19`, and `csp.ts:6`.

### 9. Inconsistent `@cloudflare/workers-types` pin — Priority 20
`lib/db/package.json` pins `^4.20260702.1`; `artifacts/api-server/package.json` pins `^4.20250906.0` — roughly a 10-month gap between two packages targeting the same Workers runtime and linked via `tsconfig` references.

### 10. `strictFunctionTypes` and `noImplicitOverride` disabled — Priority 20
`tsconfig.base.json` enables most strict flags individually but explicitly disables these two, with no comment explaining why — unlike the nearby `noUnusedLocals` flag, which is explained.

### 11. No CONTRIBUTING.md, ADRs, or runbooks — Priority 16
No file matches `CONTRIBUTING*`, `*ADR*`, or `runbook*` anywhere in the repo. Several major migrations (Express→Hono, Postgres→D1, Clerk→Better Auth, Railway→Cloudflare) are referenced only in passing prose, with no formal record of why or what broke.

### 12. `noUnusedLocals` off at the compiler level; ESLint only warns — Priority 15
`tsconfig.base.json` disables `noUnusedLocals` (comment says ESLint compensates), but `eslint.config.js` sets `no-unused-vars: "warn"` — not CI-failing. Dead code can accumulate through every PR.

### 13. Frontend runtime UI dependencies filed as devDependencies — Priority 15
`artifacts/groundworkos/package.json` lists all 27 `@radix-ui/*` packages, `react-hook-form`, `recharts`, `date-fns`, `sonner`, `cmdk`, `vaul`, etc. under `devDependencies`, while only `@react-pdf/renderer`, `@uppy/*`, and `better-auth` are under `dependencies`. Vite bundles regardless, so this doesn't break builds, but it misleads anyone auditing what ships to production.

### 14. Page components are 700–1,700+ line "God components" — Priority 14
15 of 18 files in `artifacts/groundworkos/src/pages/` exceed 500 lines: `ReportsPage.tsx` 1,661, `SettingsPage.tsx` 1,357, `PurchaseOrdersPage.tsx` 1,190, `DashboardPage.tsx` 1,181, `JobsPage.tsx` 1,162, `QuotesPage.tsx` 1,125, `TimesheetsPage.tsx` 1,034, `PortalPage.tsx` 934, `InvoicesPage.tsx` 914, `DocumentsPage.tsx` 896, `SubcontractorsPage.tsx` 879, `PlantPage.tsx` 799, `UsersPage.tsx` 758, `ImportPage.tsx` 719, `SchedulePage.tsx` 679. Combined with Finding 4, these are large, unverified, monolithic units.

### 15. `mockup-sandbox` carries a drifted, forked UI kit — Priority 8
README confirms `artifacts/mockup-sandbox` isn't part of the deployed app, but it duplicates ~50+ shadcn/Radix components from the real app's `components/ui` with independently drifted versions (e.g. `@radix-ui/react-checkbox` `^1.1.5` vs `^1.3.3`), and carries both `tailwindcss-animate` and `tw-animate-css` at once.

## Phased remediation plan

### Phase 1 — Quick wins (days, config/CI only, no feature-code risk)
1. Remove `**/*.test.ts` from tsc `exclude` in both tsconfigs, or add a dedicated `tsconfig.test.json` (#1).
2. Delete the dead `VITE_CLERK_PUBLISHABLE_KEY` line from `ci.yml`; scrub leftover Clerk comments in `app.ts`, `validateEnv.ts`, `csp.ts` (#8).
3. Align `@cloudflare/workers-types` to one version across `lib/db` and `artifacts/api-server` (#9).
4. Move `artifacts/groundworkos`'s runtime UI packages from `devDependencies` to `dependencies` (#13).
5. Flip `no-unused-vars` to `"error"`; re-audit `noUnusedLocals` (#12).
6. Require `BOOTSTRAP_ADMIN_EMAIL` in every deployed environment's `wrangler.jsonc`/checklist as an immediate mitigation for #2 while a real fix is designed.
7. Delete or redirect the in-app `/deploy` guide to DEPLOYMENT.md (#7).

### Phase 2 — Medium-term (single-sprint, test/infra work, no architecture change)
1. Add `@testing-library/react` + jsdom (or a `happy-dom` project) as a second Vitest config so frontend component tests are runnable, then cover the highest-risk flows first: invoice/quote calculation, CIS deduction math, `apiTransforms.ts` (#4).
2. Add integration tests for untested backend routes in priority order: `cis.ts` and `portal.ts` first, then `storage.ts`, then the four accounting-OAuth routes/clients (#3).
3. Turn `no-explicit-any` on as `"warn"` to baseline the 75 sites, fix incrementally, then promote to `"error"` (#6).
4. Re-enable `strictFunctionTypes` and `noImplicitOverride`; fix resulting errors package by package (#10).
5. Write a short ADR set (3–5 docs) capturing the already-made migration decisions while institutional knowledge is fresh (#11).

### Phase 3 — Larger structural work (multi-sprint, ride alongside feature work)
1. Automate Worker deployment — auto-deploy-on-merge with migration-apply as a CI step, or at minimum a CI guard that fails a PR when `wrangler.jsonc` D1/KV/R2 ids don't match the live Cloudflare account. Directly targets the class of bug behind the 2026-08-28 incident (#5).
2. Redesign admin-bootstrap so promotion isn't a side effect of an unauthenticated/first-mover GET race — e.g. require `BOOTSTRAP_ADMIN_EMAIL` before bootstrap is possible at all, or gate it behind a one-time provisioning token (#2).
3. Incrementally decompose the largest pages (`ReportsPage.tsx`, `SettingsPage.tsx` first) into data-hook + presentational pairs as each page next needs a feature change — not as a standalone refactor PR — adding tests for each extracted piece (#14).
4. Once component tests exist, retire `mockup-sandbox`'s forked UI kit in favor of the real app's `components/ui`, eliminating drift (#15).
