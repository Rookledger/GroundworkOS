# 1. Hono on Cloudflare Workers, replacing Express

**Status:** Accepted, implemented

## Context

The API previously ran as a single long-lived Express (Node.js) process
that served both the API and the frontend's static build (`STATIC_DIR`/
`BASE_PATH` env vars, since removed, indicate it served the SPA as a
fallback route too). A long-lived process meant module-level singletons
were the natural pattern: a `pg.Pool` database connection, a
pre-configured logger, in-memory `Map`s for local state, and
`express-rate-limit`'s in-memory store for rate limiting. Environment
validation ran once at process startup. Security headers came from
`helmet`.

## Decision

Rewrite the API on [Hono](https://hono.dev), deployed as a Cloudflare
Worker. Workers have no long-lived process — `c.env` (bindings, vars,
secrets) only exists per-request, so there is no module-level `db`
singleton the way `pg.Pool` was; every route reads `c.get("db")` /
`c.get("logger")`, set per-request by middleware in
`artifacts/api-server/src/app.ts`. `secureHeaders` middleware replaces
`helmet`. Environment validation moved from a one-time boot check to a
per-request check (`validateEnv` middleware) since there's no boot hook
with `c.env` access on Workers — see
`artifacts/api-server/src/lib/validateEnv.ts`.

## Consequences

**Positive**

- Frontend and backend are fully decoupled and deploy independently
  (Cloudflare Pages vs. a Worker) rather than one process serving both.
- A misconfigured environment fails loudly on the very first request with
  the full list of missing/invalid vars, instead of whichever route
  happens to read the missing one first.

**Negative / tradeoffs**

- State that needs to persist _across_ requests (rate-limit counters,
  OAuth CSRF state) had to move out of process memory and into Cloudflare
  KV, since there's no module-level `Map` that survives between requests
  any more.
- D1's Drizzle driver doesn't support interactive transactions the way
  `node-postgres` did — no holding a connection open across `await`s
  mid-request (see ADR 0002 for the database side of this).
- There is no automated Worker deploy on push by default — `wrangler
deploy` has to be run manually or wired into CI. DEPLOYMENT.md notes
  this explicitly doesn't happen automatically "the way the old Express
  version's start-command migration step did." This gap is tracked
  separately as tech-debt finding #5 (`TECH_DEBT_AUDIT.md`) and has
  already caused one production incident (see ADR 0004).

## Citations

`README.md` (Stack table, "no single combined process... unlike the
project's earlier Express architecture"); `DEPLOYMENT.md` (manual
deploy/migration note); `artifacts/api-server/src/app.ts` (per-request
`db`/`logger`/`userId`/`_role` context setup); `artifacts/api-server/src/lib/rateLimits.ts`
(KV-backed rate limiting); `artifacts/api-server/src/lib/validateEnv.ts`
(per-request env validation, with the Express-era checks it replaced
documented in its own comments); `artifacts/api-server/src/routes/quotes.ts`
(no interactive transactions, `db.batch()` used instead).
