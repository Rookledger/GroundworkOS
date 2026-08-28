import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";

/**
 * Paths that liveness/readiness probes hit. Must never be rate limited into
 * failure - see createHealthCheckLimiter below.
 */
export const HEALTH_CHECK_PATHS = ["/api/healthz", "/api/readyz"] as const;

/**
 * Unauthenticated routes that are a genuine abuse surface: the OAuth
 * provider callbacks and Better Auth's own endpoints (sign-in, session
 * refresh, etc - see app.ts, which mounts the Better Auth handler
 * unauthenticated by design, same as Clerk's hosted endpoints used to be).
 * Anyone can hit these without any auth, and a legitimate caller only ever
 * hits them a handful of times per session, so they keep a deliberately
 * tight limit.
 */
export const PUBLIC_ROUTE_PATHS = [
  "/api/xero/callback",
  "/api/quickbooks/callback",
  "/api/sage/callback",
  "/api/freeagent/callback",
  "/api/auth/*",
] as const;

/**
 * The storage upload relay. PUT'd once per file (see routes/storage.ts), so
 * a batch of site photos can rack up far more requests than the rest of the
 * API in one sitting. It gets its own, more generous limiter below rather
 * than sharing the general-purpose budget.
 */
export const STORAGE_UPLOAD_RELAY_PATH = "/api/storage/uploads/direct";

const FIFTEEN_MINUTES_SEC = 15 * 60;

/**
 * Resolves the authenticated user id for a request, if any. Must run after
 * the session middleware (see app.ts) for `userId` to be set - that
 * middleware is the only thing that ever sets it now.
 */
function authedUserId(c: Parameters<MiddlewareHandler<AppEnv>>[0]) {
  return c.get("userId") ?? undefined;
}

/**
 * Fixed-window counter stored in KV, replacing express-rate-limit's
 * in-memory store - a Worker has no long-lived process to hold that store
 * in any more (see index.ts). KV is eventually consistent and has no atomic
 * increment, so two requests racing inside the same ~tens-of-milliseconds
 * window can both read the same count and both be allowed through; that's
 * an accepted trade-off for a zero-infra limiter backed by KV rather than a
 * Durable Object. It still does its job: bounding sustained abuse over a
 * 15-minute window, not enforcing an exact quota.
 */
function kvFixedWindowLimiter(opts: {
  limit: number;
  windowSec: number;
  keyFn: (c: Parameters<MiddlewareHandler<AppEnv>>[0]) => string;
}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const window = Math.floor(Date.now() / 1000 / opts.windowSec);
    const key = `rl:${opts.keyFn(c)}:${window}`;

    const raw = await c.env.KV.get(key);
    const count = raw ? Number(raw) : 0;

    if (count >= opts.limit) {
      c.header("Retry-After", String(opts.windowSec));
      return c.json(
        { error: "Too many requests, please try again later." },
        429,
      );
    }

    // Best-effort increment - a lost write under a race just means the
    // window slightly undercounts, which is the same trade-off noted above.
    c.executionCtx.waitUntil(
      c.env.KV.put(key, String(count + 1), {
        expirationTtl: opts.windowSec + 60,
      }),
    );
    return next();
  };
}

/**
 * Per-user budget for the authenticated bulk of the /api surface.
 *
 * Keyed on the authenticated user id rather than IP: the intended deployment is a
 * single construction company, and everyone in one office can share one
 * NAT'd public IP. An IP-keyed limit would mean the whole team fights over
 * one shared budget - one person running a busy screen could 429 everyone
 * else. Keying on user id gives each teammate their own window instead.
 *
 * 300 requests per 15 minutes is generous for a single person driving the
 * app UI - dashboards, list views, and form saves are nowhere near that
 * even during heavy use - while still bounding a single compromised or
 * misbehaving account. Only mounted on authenticated /api routes (see
 * app.ts), so it never sees the anonymous, health-check, or storage-upload
 * traffic those get their own limiters for.
 */
export const createApiUserLimiter = (): MiddlewareHandler<AppEnv> =>
  kvFixedWindowLimiter({
    limit: 300,
    windowSec: FIFTEEN_MINUTES_SEC,
    keyFn: (c) => `user:${authedUserId(c) ?? "unknown"}`,
  });

/**
 * IP-keyed budget for unauthenticated traffic on the general /api surface.
 *
 * Nearly every route under /api requires a signed-in user (see
 * routes/index.ts's requireAuth) - a request that reaches here without one
 * is either a client with a stale/expired session about to be told to log
 * in again, or something scanning for open endpoints. 60 requests per 15
 * minutes (4/min) comfortably covers a legitimate client retrying around a
 * token refresh, while keeping the cost of probing the unauthenticated
 * surface from a single IP low.
 */
export const createApiAnonLimiter = (): MiddlewareHandler<AppEnv> =>
  kvFixedWindowLimiter({
    limit: 60,
    windowSec: FIFTEEN_MINUTES_SEC,
    keyFn: (c) => `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
  });

/**
 * Generous per-user limit for the bulk photo/document upload relay
 * (PUT /api/storage/uploads/direct/:id, see routes/storage.ts).
 *
 * One request per file: a single site visit can easily produce a batch of
 * a few hundred photos uploaded back-to-back, which would blow through the
 * 300/15min general budget on its own well before the rest of the team's
 * usage is even counted. 1200 requests per 15 minutes (~1.3 req/s
 * sustained) covers a large same-day batch with multiple times headroom,
 * while still bounding any single account from turning this route into an
 * unbounded write amplifier against R2.
 */
export const createStorageUploadLimiter = (): MiddlewareHandler<AppEnv> =>
  kvFixedWindowLimiter({
    limit: 1200,
    windowSec: FIFTEEN_MINUTES_SEC,
    keyFn: (c) => {
      const userId = authedUserId(c);
      return userId
        ? `user:${userId}`
        : `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`;
    },
  });

/**
 * Health/readiness probes. 3000 requests per 15 minutes (~3.3 req/s
 * sustained) leaves generous headroom for uptime monitors and Cloudflare's
 * own health probing while still capping the cost /api/readyz's `SELECT 1`
 * against D1 can be forced to.
 */
export const createHealthCheckLimiter = (): MiddlewareHandler<AppEnv> =>
  kvFixedWindowLimiter({
    limit: 3000,
    windowSec: FIFTEEN_MINUTES_SEC,
    keyFn: (c) => `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
  });

/** Tight limit for the unauthenticated OAuth callbacks. */
export const createPublicRouteLimiter = (): MiddlewareHandler<AppEnv> =>
  kvFixedWindowLimiter({
    limit: 30,
    windowSec: FIFTEEN_MINUTES_SEC,
    keyFn: (c) => `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
  });
