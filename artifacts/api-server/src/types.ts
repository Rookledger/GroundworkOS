import type { Database } from "@workspace/db";
import type { Logger } from "./lib/logger";

/**
 * Cloudflare bindings + secrets/vars this Worker declares in wrangler.jsonc.
 * Keep this in sync with that file - `wrangler types` can regenerate a
 * stricter version of this (worker-configuration.d.ts) straight from the
 * config once the real D1/R2/KV ids are filled in.
 */
export type Bindings = {
  DB: D1Database;
  DOCS_BUCKET: R2Bucket;
  KV: KVNamespace;

  APP_URL?: string;
  BETTER_AUTH_SECRET: string;
  BOOTSTRAP_ADMIN_EMAIL?: string;
  SIGNUP_ALLOWED_EMAIL_DOMAINS?: string;

  RESEND_API_KEY?: string;

  XERO_CLIENT_ID?: string;
  XERO_CLIENT_SECRET?: string;
  XERO_REDIRECT_URI?: string;
  QUICKBOOKS_CLIENT_ID?: string;
  QUICKBOOKS_CLIENT_SECRET?: string;
  QUICKBOOKS_REDIRECT_URI?: string;
  SAGE_CLIENT_ID?: string;
  SAGE_CLIENT_SECRET?: string;
  SAGE_REDIRECT_URI?: string;
  FREEAGENT_CLIENT_ID?: string;
  FREEAGENT_CLIENT_SECRET?: string;
  FREEAGENT_REDIRECT_URI?: string;
};

/** Per-request values attached by middleware (see app.ts). */
export type Variables = {
  db: Database;
  logger: Logger;
  /** Better Auth user id of the caller, set by the session middleware in
   * app.ts once a valid session is resolved. */
  userId?: string;
  /** The caller's role, set alongside `userId` by the same session
   * middleware - read directly off the session's own D1-backed user row, so
   * every other reader (getUserRole, requireRole, admin.ts) just reads this
   * instead of doing its own lookup. */
  _role?: import("@workspace/shared-role").Role;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
