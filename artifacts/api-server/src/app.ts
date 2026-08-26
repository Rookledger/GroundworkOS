import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { clerkMiddleware } from "@hono/clerk-auth";
import { createDb } from "@workspace/db";
import router from "./routes";
import { buildCspDirectives } from "./lib/csp";
import { validateEnv } from "./lib/validateEnv";
import { logger } from "./lib/logger";
import {
  HEALTH_CHECK_PATHS,
  PUBLIC_ROUTE_PATHS,
  STORAGE_UPLOAD_RELAY_PATH,
  createApiAnonLimiter,
  createApiUserLimiter,
  createHealthCheckLimiter,
  createPublicRouteLimiter,
  createStorageUploadLimiter,
} from "./lib/rateLimits";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

/**
 * Validates required bindings/vars on every request rather than once at
 * boot: there is no module-load-time hook with access to `c.env` the way
 * the old Express `index.ts`'s `import "./lib/validateEnv"` had (bindings
 * only exist per-request on Workers). Cheap - a handful of string checks -
 * so running it per-request costs nothing meaningful, and it fails loudly
 * with the full list of problems instead of whichever route happens to
 * touch a missing var first.
 */
app.use(async (c, next) => {
  const errors = validateEnv(c.env);
  if (errors.length > 0) {
    for (const error of errors) logger.error(error);
    return c.json(
      { error: { message: "Server misconfigured", status: 500 } },
      500,
    );
  }
  return next();
});

/**
 * Request-scoped Drizzle instance over the D1 binding, and the logger -
 * both pulled off the context (`c.get("db")` / `c.get("logger")`) by every
 * route/lib function instead of importing a module-level singleton. There
 * is no such singleton any more: `c.env.DB` (and the rest of `c.env`) only
 * exists for the lifetime of one request, unlike the old `pg.Pool` that
 * lived for the whole container's life.
 */
app.use(async (c, next) => {
  c.set("db", createDb(c.env.DB));
  c.set("logger", logger);
  await next();
});

/**
 * Security headers. Hono's secureHeaders sets a restrictive
 * Content-Security-Policy and other hardening headers on every response,
 * mirroring what helmet did on the Express version. Clerk's browser SDK
 * loads from - and calls back to - the Clerk Frontend API origin encoded in
 * CLERK_PUBLISHABLE_KEY, so buildCspDirectives adds that origin wherever
 * Clerk needs it (see lib/csp.ts). HSTS is left to Cloudflare's edge, which
 * already terminates TLS for the zone and adds it there.
 */
app.use(async (c, next) =>
  secureHeaders({
    contentSecurityPolicy: buildCspDirectives(c.env.CLERK_PUBLISHABLE_KEY),
    crossOriginEmbedderPolicy: false,
    // Superseded by the CSP's own frame-ancestors directive above.
    xFrameOptions: false,
  })(c, next),
);

/**
 * When APP_URL is set (required in production - see validateEnv.ts), only
 * that origin may make credentialed cross-origin requests. The frontend now
 * deploys separately to Cloudflare Pages (rather than being served by this
 * same process, as the old STATIC_DIR single-service setup did on Railway),
 * so this is the only thing standing between the API and an arbitrary
 * origin.
 */
app.use(async (c, next) =>
  cors({ credentials: true, origin: c.env.APP_URL || "*" })(c, next),
);

app.use(clerkMiddleware());

/**
 * Rate limiting. Mounted after clerkMiddleware (above) so `getAuth(c)` is
 * populated and the limiters below can key off the authenticated Clerk user
 * id instead of just IP - a whole company office can sit behind one NAT'd
 * public IP and would otherwise share a single budget. See lib/rateLimits.ts
 * for each limiter and the reasoning behind its numbers: a per-user budget
 * for authenticated API traffic, a separate and tighter IP-keyed budget for
 * unauthenticated traffic, a more generous per-user budget for the bulk
 * photo/document upload relay, a much tighter limit on the unauthenticated
 * OAuth callbacks and Clerk webhook, and a deliberately high limit on the
 * health/readiness probes so uptime monitors can never rate-limit
 * themselves into a false "down".
 */
for (const path of HEALTH_CHECK_PATHS) app.use(path, createHealthCheckLimiter());
for (const path of PUBLIC_ROUTE_PATHS) app.use(path, createPublicRouteLimiter());
app.use(`${STORAGE_UPLOAD_RELAY_PATH}/*`, createStorageUploadLimiter());

app.use("/api/*", createApiUserLimiter());
app.use("/api/*", createApiAnonLimiter());

app.route("/api", router);

app.notFound((c) =>
  c.json({ error: { message: "Not found", status: 404 } }, 404),
);

/**
 * Final error handler. Registered last so it catches errors thrown by any
 * route or middleware mounted above, and always responds with a consistent
 * JSON error shape instead of an unhandled-exception stack trace leaking to
 * the client.
 */
app.onError((err, c) => {
  const status =
    typeof (err as unknown as { status?: unknown }).status === "number"
      ? ((err as unknown as { status: number })
          .status as 400 | 401 | 403 | 404 | 500)
      : 500;

  logger.error(
    { err, status, method: c.req.method, url: c.req.url },
    "Unhandled request error",
  );

  return c.json(
    {
      error: {
        message: status === 500 ? "Internal server error" : err.message,
        status,
      },
    },
    status,
  );
});

export default app;
