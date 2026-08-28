import type { Bindings } from "../types";

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
 *  - The Clerk publishable-key consistency check that used to read a
 *    `clerk-manifest.json` the frontend build wrote next to STATIC_DIR -
 *    Better Auth runs same-origin on this Worker (see lib/betterAuth.ts)
 *    and the frontend never inlines any auth secret at build time, so
 *    there's nothing left for the two sides to disagree about.
 */
const REQUIRED_ENV_VARS = [
  "APP_URL",
  "BETTER_AUTH_SECRET",
] as const satisfies readonly (keyof Bindings)[];

/**
 * Better Auth's own docs recommend at least a 32-character secret (it's
 * used for session token signing/encryption) - a short or empty value
 * passes the plain "is it set" check above but produces a Worker that signs
 * sessions with a trivially guessable secret. Validate the length here so a
 * weak secret fails loudly instead of silently shipping.
 */
const MIN_SECRET_LENGTH = 32;

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

  if (
    env.BETTER_AUTH_SECRET &&
    env.BETTER_AUTH_SECRET.length < MIN_SECRET_LENGTH
  ) {
    errors.push(
      `Invalid BETTER_AUTH_SECRET: must be at least ${MIN_SECRET_LENGTH} characters (generate one with e.g. \`openssl rand -base64 32\`)`,
    );
  }

  return errors;
}
