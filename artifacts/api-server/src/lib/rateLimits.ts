import rateLimit from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { getAuth } from "@clerk/express";

/**
 * Paths that liveness/readiness probes hit. These are the paths Railway's
 * healthcheck (see railway.json -> deploy.healthcheckPath) and any external
 * uptime monitor poll, so they must never be rate limited into failure.
 */
export const HEALTH_CHECK_PATHS = ["/api/healthz", "/api/readyz"] as const;

/**
 * Unauthenticated routes that are a genuine abuse surface: the OAuth provider
 * callbacks and the Clerk webhook. Anyone can hit these without any auth, and
 * a legitimate caller only ever hits them a handful of times, so they keep a
 * deliberately tight limit.
 */
export const PUBLIC_ROUTE_PATHS = [
  "/api/xero/callback",
  "/api/quickbooks/callback",
  "/api/sage/callback",
  "/api/freeagent/callback",
  "/api/webhooks/clerk",
] as const;

/**
 * The storage upload relay. PUT'd once per file (see routes/storage.ts), so
 * a batch of site photos can rack up far more requests than the rest of the
 * API in one sitting. It gets its own, more generous limiter below rather
 * than sharing the general-purpose budget.
 */
export const STORAGE_UPLOAD_RELAY_PATH = "/api/storage/uploads/direct";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Path of the current request, independent of where the limiter is mounted. */
const requestPath = (req: { originalUrl: string }): string =>
  req.originalUrl.split("?")[0];

const isHealthCheckPath = (req: { originalUrl: string }): boolean =>
  (HEALTH_CHECK_PATHS as readonly string[]).includes(requestPath(req));

const isStorageUploadPath = (req: { originalUrl: string }): boolean =>
  requestPath(req).startsWith(`${STORAGE_UPLOAD_RELAY_PATH}/`);

/**
 * Resolves the authenticated Clerk user id for a request, if any.
 *
 * Mirrors the lookup routes/index.ts's requireAuth performs (session claims
 * first, then the top-level auth object) so the limiter and the actual auth
 * check agree on who counts as "authenticated". Must run after
 * clerkMiddleware (see app.ts) for getAuth to have anything to read - the
 * limiters below are mounted after it for exactly this reason. Returns
 * undefined for an unauthenticated request.
 */
const clerkUserId = (req: Request): string | undefined => {
  const auth = getAuth(req);
  return (
    (auth as { sessionClaims?: { userId?: string } } | null)?.sessionClaims
      ?.userId || auth?.userId || undefined
  );
};

const isAuthenticated = (req: Request): boolean => Boolean(clerkUserId(req));

/**
 * Per-user budget for the authenticated bulk of the /api surface.
 *
 * Keyed on the Clerk user id rather than IP: the intended deployment is a
 * single construction company behind Railway, and everyone in one office
 * shares one NAT'd public IP. An IP-keyed limit would mean the whole team
 * fights over one shared budget - one person running a busy screen could
 * 429 everyone else. Keying on user id gives each teammate their own
 * window instead.
 *
 * 300 requests per 15 minutes (the same total the old shared-IP limiter
 * used) per user is generous for a single person driving the app UI -
 * dashboards, list views, and form saves are nowhere near that even during
 * heavy use - while still bounding a single compromised/misbehaving
 * account.
 *
 * Skips: unauthenticated requests (handled by createApiAnonLimiter below),
 * health checks (handled by createHealthCheckLimiter, mounted separately
 * but still reachable through this "/api" prefix), and the storage upload
 * relay (handled by createStorageUploadLimiter) - so a given request is
 * only ever charged against one limiter.
 */
export const createApiUserLimiter = (): RequestHandler =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      isHealthCheckPath(req) ||
      isStorageUploadPath(req) ||
      !isAuthenticated(req),
    keyGenerator: (req) => `user:${clerkUserId(req) ?? "unknown"}`,
    message: { error: "Too many requests, please try again later." },
  });

/**
 * IP-keyed budget for unauthenticated traffic on the general /api surface.
 *
 * Nearly every route under /api requires a signed-in user (see
 * routes/index.ts's requireAuth) - a request that reaches here without one
 * is either a client with a stale/expired session about to be told to log
 * in again, or something scanning for open endpoints. Neither needs
 * anywhere near the per-user budget above.
 *
 * 60 requests per 15 minutes (4/min) comfortably covers a legitimate
 * client retrying around a token refresh, while keeping the cost of
 * probing the unauthenticated surface from a single IP low. This stays
 * IP-keyed (there's no user id to key on yet) and deliberately separate
 * from the per-user limiter so anonymous traffic sharing an office's NAT
 * IP can never crowd out - or borrow budget from - that office's actual
 * signed-in teammates.
 */
export const createApiAnonLimiter = (): RequestHandler =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      isHealthCheckPath(req) ||
      isStorageUploadPath(req) ||
      isAuthenticated(req),
    message: { error: "Too many requests, please try again later." },
  });

/**
 * Generous per-user limit for the bulk photo/document upload relay
 * (PUT /api/storage/uploads/direct/:id, see routes/storage.ts).
 *
 * One request per file: a single site visit can easily produce a batch of
 * a few hundred photos uploaded back-to-back, which would blow through the
 * 300/15min general budget on its own well before the rest of the team's
 * usage is even counted. 1200 requests per 15 minutes (~1.3 req/s
 * sustained) covers a large same-day batch (several hundred photos, plus
 * retries) with multiple times headroom, while still bounding any single
 * account from turning this route into an unbounded write amplifier
 * against object storage.
 *
 * Keyed on the Clerk user id when available, matching the per-user limiter
 * above. This route is manager-gated by requireRole (routes/storage.ts),
 * but that check runs downstream in the route handler, after this limiter
 * - so an unauthenticated request that will ultimately be rejected with
 * 403 still needs a key here, and falls back to IP.
 */
export const createStorageUploadLimiter = (): RequestHandler =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 1200,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const userId = clerkUserId(req);
      return userId ? `user:${userId}` : `ip:${req.ip ?? "unknown"}`;
    },
    message: { error: "Too many requests, please try again later." },
  });

/**
 * Health/readiness probes.
 *
 * 3000 requests per 15 minutes is ~3.3 req/s sustained from a single IP.
 * Sizing rationale:
 *   - a 1-second uptime poll costs 900 requests per window;
 *   - Railway's deploy healthcheck retries /api/readyz repeatedly for up to
 *     healthcheckTimeout (300s) while a cold Postgres warms up;
 *   - several probes can share one egress IP (NAT'd monitoring vendors, or
 *     Railway's own prober), so the budget has to cover more than one poller.
 * 3000 leaves ~3x headroom over the worst realistic legitimate case while
 * still capping any single IP: /api/readyz issues a `SELECT 1`, so an
 * unbounded route would be a cheap way to push load onto the database.
 */
export const createHealthCheckLimiter = (): RequestHandler =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 3000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

/** Tight limit for the unauthenticated OAuth callbacks and Clerk webhook. */
export const createPublicRouteLimiter = (): RequestHandler =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
