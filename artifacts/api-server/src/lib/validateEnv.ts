import type { Bindings } from "../types";
import { parseAllowedDomains } from "./signupPolicy";

/**
 * Every var the Worker cannot run without. Checked together, on each
 * request's first pass through the `validateEnv` middleware (see app.ts),
 * so a misconfigured environment fails loudly with a full list instead of
 * a route deep in the app throwing on whichever var it happens to read
 * first.
 *
 * This dropped a few checks the old Railway/Express version had that no
 * longer apply on Workers:
 *  - PORT / DATABASE_URL / S3_* - gone with Express's own listener and the
 *    S3-compatible object storage backend (see objectStorage.ts / R2).
 *  - BASE_PATH / STATIC_DIR - the frontend now deploys separately to
 *    Cloudflare Pages instead of being served by this server as a SPA
 *    fallback (see app.ts), so there is no local build output for this
 *    Worker to know about.
 *  - The CLERK_PUBLISHABLE_KEY / VITE_CLERK_PUBLISHABLE_KEY consistency
 *    check that used to read a `clerk-manifest.json` the frontend build
 *    wrote next to STATIC_DIR - there is no shared filesystem between this
 *    Worker and the separately-deployed Pages project for that any more.
 *    Keeping the two publishable keys in sync is now a deploy-process
 *    concern (e.g. a CI check comparing the two secrets) rather than
 *    something this Worker can verify for itself at request time.
 */
const REQUIRED_ENV_VARS = [
  "APP_URL",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
] as const satisfies readonly (keyof Bindings)[];

/**
 * A Clerk publishable key is `pk_(test|live)_` followed by the base64
 * encoding of `<frontend-api-hostname>$` (see also csp.ts, which decodes
 * this at runtime to build the CSP header). A key that's merely
 * non-empty — a secret key pasted into the wrong variable, a truncated
 * copy-paste, a stray quote character — passes the old "is it set" check
 * but makes every Clerk SDK call fail silently, taking every route down
 * (including /healthz) with nothing logged to explain why. Validate the
 * shape here so a bad key fails loudly instead.
 *
 * Clerk issues these keys unpadded (no trailing "="), so the padding in
 * the trailing group below is optional — a key copied straight from the
 * Clerk Dashboard has a body length that's rarely a multiple of 4 and
 * carries no "=" at all. Requiring padding here rejected every real Clerk
 * key.
 */
const PUBLISHABLE_KEY_RE = /^pk_(test|live)_(.+)$/;
const BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(==)?|[A-Za-z0-9+/]{3}=?)?$/;
const HOSTNAME_RE =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
const SECRET_KEY_RE = /^sk_(test|live)_[A-Za-z0-9]+$/;

export function isValidPublishableKey(value: string): boolean {
  const match = PUBLISHABLE_KEY_RE.exec(value);
  if (!match) return false;

  const body = match[2];
  if (!BASE64_RE.test(body)) return false;

  let decoded: string;
  try {
    decoded = atob(body);
  } catch {
    return false;
  }
  if (!decoded.endsWith("$")) return false;

  return HOSTNAME_RE.test(decoded.slice(0, -1));
}

export function isValidSecretKey(value: string): boolean {
  return SECRET_KEY_RE.test(value);
}

const WEBHOOK_SIGNING_SECRET_RE = /^whsec_.+$/;

/**
 * Validates `env`, returning a list of human-readable problems (empty when
 * everything checks out). Pure and side-effect free so it's cheap to call
 * on every request from the `validateEnv` middleware in app.ts, which turns
 * a non-empty result into a 500 with the full list logged.
 */
export function validateEnv(env: Bindings): string[] {
  const errors: string[] = [];

  for (const name of REQUIRED_ENV_VARS) {
    if (!env[name]) {
      errors.push(`Missing required environment variable: ${name}`);
    }
  }

  if (env.CLERK_PUBLISHABLE_KEY && !isValidPublishableKey(env.CLERK_PUBLISHABLE_KEY)) {
    errors.push(
      'Invalid CLERK_PUBLISHABLE_KEY: expected "pk_test_" or "pk_live_" followed by base64 that decodes to a hostname ending in "$" (e.g. pk_test_<base64("your-app.clerk.accounts.dev$")>)',
    );
  }

  if (env.CLERK_SECRET_KEY && !isValidSecretKey(env.CLERK_SECRET_KEY)) {
    errors.push(
      'Invalid CLERK_SECRET_KEY: expected "sk_test_" or "sk_live_" followed by the key value',
    );
  }

  /**
   * Optional: only relevant if the Clerk webhook (routes/clerk_webhook.ts)
   * is in use for the SIGNUP_ALLOWED_EMAIL_DOMAINS backstop. Not in
   * REQUIRED_ENV_VARS since most deployments rely on Clerk Dashboard
   * Restrictions alone and never set it.
   */
  if (
    env.CLERK_WEBHOOK_SIGNING_SECRET &&
    !WEBHOOK_SIGNING_SECRET_RE.test(env.CLERK_WEBHOOK_SIGNING_SECRET)
  ) {
    errors.push(
      'Invalid CLERK_WEBHOOK_SIGNING_SECRET: expected "whsec_" followed by the signing secret value',
    );
  }

  /**
   * If SIGNUP_ALLOWED_EMAIL_DOMAINS is set, the Clerk webhook
   * (routes/clerk_webhook.ts) can't enforce it without
   * CLERK_WEBHOOK_SIGNING_SECRET to verify incoming webhook signatures -
   * the allowlist would silently never apply.
   */
  const allowedDomains = parseAllowedDomains(env.SIGNUP_ALLOWED_EMAIL_DOMAINS);
  if (allowedDomains.length > 0 && !env.CLERK_WEBHOOK_SIGNING_SECRET) {
    errors.push(
      "SIGNUP_ALLOWED_EMAIL_DOMAINS is set but CLERK_WEBHOOK_SIGNING_SECRET is not - " +
        "incoming webhooks can't be verified, so the domain allowlist would never be enforced. " +
        "Set CLERK_WEBHOOK_SIGNING_SECRET or unset SIGNUP_ALLOWED_EMAIL_DOMAINS.",
    );
  }

  return errors;
}
