/**
 * Builds the Content-Security-Policy directives object consumed by Hono's
 * `secureHeaders` middleware (see app.ts).
 *
 * Clerk's browser SDK used to load from - and call back to - a per-instance
 * Clerk Frontend API origin decoded out of CLERK_PUBLISHABLE_KEY, which is
 * why this used to need to allow-list that origin everywhere the SDK
 * touched (script-src, connect-src, img-src, worker-src, frame-src). Better
 * Auth has no such external origin: it's mounted at `/api/auth/*` on this
 * same Worker (see app.ts) and the frontend talks to it via same-site
 * fetch/cookies, so everything it needs is already covered by 'self'.
 */
export function buildCspDirectives(): Record<string, string[]> {
  return {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "connect-src": ["'self'"],
    "worker-src": ["'self'", "blob:", "data:"],
    "frame-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
  };
}
