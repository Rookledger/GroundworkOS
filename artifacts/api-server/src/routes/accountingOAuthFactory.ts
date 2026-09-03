import { Hono } from "hono";
import type { Context } from "hono";
import { requireRole } from "../lib/auth.js";
import type { AppEnv } from "../types";

interface ConnectionBase {
  connectedAt: Date;
  updatedAt: Date;
}

export interface AccountingOAuthConfig<TConn extends ConnectionBase> {
  /** URL segment for this provider's routes, e.g. "xero" -> /xero/status. */
  provider: string;
  /** Human-readable name used in the "not configured" error message. */
  displayName: string;
  /** Env var names surfaced in that same error message. */
  envVars: { clientId: string; clientSecret: string; redirectUri: string };
  /** Builds the provider's authorisation URL for the given CSRF state. */
  buildAuthUrl: (c: Context<AppEnv>, state: string) => string;
  /**
   * Exchanges the OAuth code for tokens, resolves whatever account metadata
   * the provider requires (tenant/company/business), and persists the
   * connection. Throws on failure.
   */
  completeConnection: (
    c: Context<AppEnv>,
    code: string,
    query: Record<string, string>,
  ) => Promise<void>;
  getConnection: (c: Context<AppEnv>) => Promise<TConn | null>;
  disconnect: (c: Context<AppEnv>) => Promise<void>;
  /** Provider-specific fields to merge into a "connected" status response. */
  statusFields: (conn: TConn) => Record<string, unknown>;
}

/** 32 lowercase hex chars, the Web Crypto equivalent of the old
 * `crypto.randomBytes(16).toString("hex")`. */
function randomStateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Builds the shared connect / callback / disconnect / status routes for an
 * accounting provider. Sync and pull endpoints stay in each provider's own
 * route file since they call provider-specific lib functions.
 *
 * OAuth CSRF state used to live in a per-process in-memory Map, which
 * doesn't survive Workers' stateless per-request model (there is no
 * guarantee two requests in the same OAuth round-trip hit the same isolate).
 * It's now stored in KV with a 10-minute TTL instead - functionally
 * equivalent, with the caveat that KV writes are eventually consistent, so a
 * callback that lands within a second or two of the auth redirect on a
 * different colo could in theory see a stale "not found" and have to retry
 * the connect flow. Acceptable for a human-driven OAuth click-through.
 */
export function createAccountingOAuthRouter<TConn extends ConnectionBase>(
  config: AccountingOAuthConfig<TConn>,
): Hono<AppEnv> {
  const {
    provider,
    displayName,
    envVars,
    buildAuthUrl,
    completeConnection,
    getConnection,
    disconnect,
    statusFields,
  } = config;

  const router = new Hono<AppEnv>();
  const stateKey = (state: string) => `oauth:${provider}:state:${state}`;

  // ─── Status ──────────────────────────────────────────────────────────────

  router.get(`/${provider}/status`, requireRole("admin"), async (c) => {
    try {
      const conn = await getConnection(c);
      if (!conn) return c.json({ connected: false });
      return c.json({
        connected: true,
        ...statusFields(conn),
        connectedAt: conn.connectedAt,
        updatedAt: conn.updatedAt,
      });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // ─── OAuth ───────────────────────────────────────────────────────────────

  router.get(`/${provider}/auth`, requireRole("admin"), async (c) => {
    try {
      const state = randomStateToken();
      // Fire-and-forget: don't let a KV write failure (e.g. the account's
      // daily write quota being exhausted - see rateLimits.ts's comment on
      // the same underlying limit) block the redirect to the provider's own
      // login page. Worst case if this write is lost, the callback below
      // fails its state check and the user has to click "Connect" again -
      // far better than never leaving this app's own error page.
      c.executionCtx.waitUntil(
        c.env.KV.put(stateKey(state), "1", { expirationTtl: 600 }), // 10 min
      );
      return c.redirect(buildAuthUrl(c, state));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Configuration error";
      return c.text(
        `${displayName} not configured: ${msg}. Please set ${envVars.clientId}, ${envVars.clientSecret}, and ${envVars.redirectUri}.`,
        500,
      );
    }
  });

  router.get(`/${provider}/callback`, async (c) => {
    const { code, state, error } = c.req.query();

    if (error) {
      return c.redirect(
        `/settings?${provider}=error&msg=${encodeURIComponent(error)}`,
      );
    }
    if (!state || !(await c.env.KV.get(stateKey(state)))) {
      return c.text("Invalid OAuth state — please try connecting again.", 400);
    }
    await c.env.KV.delete(stateKey(state));

    try {
      await completeConnection(c, code, c.req.query());
      return c.redirect(`/settings?${provider}=connected`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.redirect(
        `/settings?${provider}=error&msg=${encodeURIComponent(msg)}`,
      );
    }
  });

  // ─── Disconnect ──────────────────────────────────────────────────────────

  router.delete(`/${provider}/disconnect`, requireRole("admin"), async (c) => {
    try {
      await disconnect(c);
      return c.json({ disconnected: true });
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  return router;
}
