import { Router } from "express";
import crypto from "crypto";
import { requireRole } from "../lib/auth.js";

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
  buildAuthUrl: (state: string) => string;
  /**
   * Exchanges the OAuth code for tokens, resolves whatever account metadata
   * the provider requires (tenant/company/business), and persists the
   * connection. Throws on failure.
   */
  completeConnection: (
    code: string,
    query: Record<string, string>,
  ) => Promise<void>;
  getConnection: () => Promise<TConn | null>;
  disconnect: () => Promise<void>;
  /** Provider-specific fields to merge into a "connected" status response. */
  statusFields: (conn: TConn) => Record<string, unknown>;
}

/**
 * Builds the shared connect / callback / disconnect / status routes for an
 * accounting provider. Sync and pull endpoints stay in each provider's own
 * route file since they call provider-specific lib functions.
 */
export function createAccountingOAuthRouter<TConn extends ConnectionBase>(
  config: AccountingOAuthConfig<TConn>,
): Router {
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

  const router = Router();

  // Simple in-memory state store (per-process, sufficient for OAuth CSRF protection)
  const oauthStates = new Map<string, number>();

  function cleanStates() {
    const cutoff = Date.now() - 10 * 60 * 1000; // 10 min
    for (const [k, t] of oauthStates) if (t < cutoff) oauthStates.delete(k);
  }

  // ─── Status ──────────────────────────────────────────────────────────────

  router.get(`/${provider}/status`, requireRole("admin"), async (_req, res) => {
    try {
      const conn = await getConnection();
      if (!conn) return res.json({ connected: false });
      return res.json({
        connected: true,
        ...statusFields(conn),
        connectedAt: conn.connectedAt,
        updatedAt: conn.updatedAt,
      });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  });

  // ─── OAuth ───────────────────────────────────────────────────────────────

  router.get(`/${provider}/auth`, requireRole("admin"), (_req, res) => {
    try {
      cleanStates();
      const state = crypto.randomBytes(16).toString("hex");
      oauthStates.set(state, Date.now());
      res.redirect(buildAuthUrl(state));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Configuration error";
      res
        .status(500)
        .send(
          `${displayName} not configured: ${msg}. Please set ${envVars.clientId}, ${envVars.clientSecret}, and ${envVars.redirectUri}.`,
        );
    }
  });

  router.get(`/${provider}/callback`, async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(
        `/settings?${provider}=error&msg=${encodeURIComponent(error)}`,
      );
    }
    if (!state || !oauthStates.has(state)) {
      return res
        .status(400)
        .send("Invalid OAuth state — please try connecting again.");
    }
    oauthStates.delete(state);

    try {
      await completeConnection(code, req.query as Record<string, string>);
      res.redirect(`/settings?${provider}=connected`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.redirect(
        `/settings?${provider}=error&msg=${encodeURIComponent(msg)}`,
      );
    }
  });

  // ─── Disconnect ──────────────────────────────────────────────────────────

  router.delete(
    `/${provider}/disconnect`,
    requireRole("admin"),
    async (_req, res) => {
      try {
        await disconnect();
        res.json({ disconnected: true });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    },
  );

  return router;
}
