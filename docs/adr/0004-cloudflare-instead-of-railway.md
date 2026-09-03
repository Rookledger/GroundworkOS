# 4. Cloudflare Pages + Workers, replacing Railway

**Status:** Accepted, implemented

## Context

The app previously deployed to Railway as a single combined process (the
same Express process described in ADR 0001) serving both the API and the
frontend's static build, connected to Postgres via `DATABASE_URL` and an
S3-compatible object storage backend via `S3_*` env vars. Deploys and
database migrations ran automatically as part of the process's start
command. No source file in the current repo names "Railway" directly by
this point — the only remaining trace is a commit message ("Remove
leftover Railway references") — so this ADR documents the platform that
replaced it rather than reconstructing exact old-platform specifics beyond
what's inferable from the "old Express/Postgres/VPS setup" framing
elsewhere in the repo's history.

## Decision

Split the app into two independent Cloudflare projects: the frontend as a
static Cloudflare Pages build, and the API as a Cloudflare Worker (Hono)
backed by D1, R2 and KV bindings (see ADR 0001/0002). The two are wired
together same-origin by binding a Workers Route for `/api/*` on the same
domain Pages serves — the frontend calls relative `/api/...` paths, so
this keeps everything same-origin without CORS being the primary
mechanism (CORS is configured as defense-in-depth; the Route binding is
what actually gets `/api/*` traffic to the Worker at all). Cloudflare
Workers have no single `.env` file: non-secret config lives in
`wrangler.jsonc`'s `vars`, secrets are set with `wrangler secret put`, and
frontend build-time vars are Cloudflare Pages build environment variables
— three genuinely different mechanisms for what used to be one `.env`.
Multi-client deployment uses named Wrangler environments
(`env.<client-slug>`) with a manual, `workflow_dispatch`-only
`deploy.yml`.

## Reasons

- Cost/scale fit: DEPLOYMENT.md states the setup is expected to be usable
  on Cloudflare's free tier at GroundworkOS's likely scale.
- The frontend still gets automatic deploys via Cloudflare Pages' Git
  integration, preserving the "push to deploy" experience Railway gave —
  just not on the API side (see below).

## Consequences

**Positive** — frontend and backend deploy and scale independently; no
server to provision or patch.

**Negative / tradeoffs**

- Unlike Pages, the Worker does **not** redeploy on push by default —
  `wrangler deploy` has to be run manually, or CI has to be wired to do
  it (tracked as tech-debt finding #5). This asymmetry between an
  auto-deploying frontend and a manually-deployed backend has already
  caused a real incident: a commit briefly pointed the D1/KV bindings at
  a `ktr-groundworks`/`ktr-groundworks-kv` database and namespace that do
  not exist in this Cloudflare account, confirmed directly in the
  Cloudflare dashboard on 2026-08-28 and since reverted (the R2 bucket
  name was correct throughout). Current `wrangler.jsonc` uses
  `database_name: "groundworkos"` and `bucket_name:
"ktr-groundworks-docs"`.
- D1 migrations require a separate manual `wrangler d1 migrations apply
--remote` step after every Worker deploy — this doesn't happen
  automatically the way the old start-command migration step did.
- Single-tenant-per-deployment architecture: each client needs their own
  Worker/D1/KV/R2, using per-client Wrangler environments (or repo forks)
  as the scaling mechanism past a handful of clients — a structural
  tradeoff of the "each customer gets their own Cloudflare account
  resources" model versus Railway's more centralized multi-tenant hosting.
- The in-app `/deploy` "Deploy Guide" page — an ops runbook that
  described the old Postgres/VPS setup — has since been removed from
  production routing and admin navigation entirely (see
  `DashboardLayout.tsx`); DEPLOYMENT.md is now the single source of truth
  for deployment steps.

## Citations

`README.md` (Stack table, Deployment section); `DEPLOYMENT.md`
(provisioning steps, env var mechanisms, CORS-as-fallback note, the
2026-08-28 incident writeup, multi-client Wrangler environments);
`artifacts/api-server/src/app.ts` (CORS/Route-binding comment);
`artifacts/api-server/src/lib/validateEnv.ts`; `artifacts/api-server/wrangler.jsonc`
(`database_name`, `bucket_name`); `artifacts/groundworkos/src/components/layout/DashboardLayout.tsx`
(Deploy Guide removal); `TECH_DEBT_AUDIT.md` findings #5 and #7 (this ADR
set, `docs/adr/README.md`, itself exists to close out finding #11).
