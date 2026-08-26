import app from "./app";

/**
 * Workers entry point. There is no `app.listen()` / long-lived process any
 * more - the runtime calls `fetch()` once per incoming request on whichever
 * V8 isolate is handling it, so nothing in this module (or anything it
 * imports) may rely on process-lifetime state surviving between requests
 * (see src/lib/rateLimits.ts and src/routes/accountingOAuthFactory.ts,
 * which used to keep in-memory Maps and now use the KV binding instead).
 *
 * Env var validation (the old src/lib/validateEnv.ts side-effecting import)
 * also can't run at module load any more - bindings/vars only exist inside
 * a request's `c.env`, not at import time - so it now runs as the first
 * middleware in app.ts instead (see validateEnv there).
 */
export default app;
