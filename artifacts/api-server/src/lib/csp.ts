/**
 * Clerk's browser SDK (clerk.browser.js) is served from - and makes its XHR
 * calls back to - the Clerk Frontend API host, which is per-instance rather
 * than a single fixed Clerk domain. That host isn't configured separately:
 * it's embedded in CLERK_PUBLISHABLE_KEY, which has the shape
 * `pk_(test|live)_<base64>`, where the base64 segment decodes to
 * `<frontend-api-host>$` (note the trailing `$`).
 */
export function decodeClerkFrontendApiHost(
  publishableKey: string | undefined,
): string | null {
  if (!publishableKey) return null;

  const match = publishableKey.match(/^pk_(test|live)_(.+)$/);
  if (!match) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(match[2], "base64").toString("utf-8");
  } catch {
    return null;
  }

  if (!decoded.endsWith("$")) return null;

  return decoded.slice(0, -1);
}

export function clerkFrontendApiOrigin(
  publishableKey: string | undefined,
): string | null {
  const host = decodeClerkFrontendApiHost(publishableKey);
  return host ? `https://${host}` : null;
}

/**
 * Builds the helmet Content-Security-Policy `directives` object. When
 * CLERK_PUBLISHABLE_KEY is set, the Clerk Frontend API origin it encodes is
 * added everywhere Clerk's SDK needs it at runtime: script-src (loading
 * clerk.browser.js), connect-src (the SDK's XHR/fetch calls), img-src (user
 * avatars), worker-src (Clerk's background token-refresh worker), and
 * frame-src (Clerk's bot-protection challenge and account-portal iframes).
 * blob: and data: are allowed on worker-src/img-src because Clerk creates
 * its worker from a blob: URL and can render avatar/data: images.
 */
export function buildCspDirectives(
  publishableKey: string | undefined,
): Record<string, string[]> {
  const origin = clerkFrontendApiOrigin(publishableKey);
  const clerkOrigins = origin ? [origin] : [];

  return {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...clerkOrigins],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...clerkOrigins],
    "connect-src": ["'self'", ...clerkOrigins],
    "worker-src": ["'self'", "blob:", "data:", ...clerkOrigins],
    "frame-src": ["'self'", ...clerkOrigins],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
  };
}
