import fs from "fs";
import path from "path";
import { logger } from "./logger";
import { parseAllowedDomains } from "./signupPolicy";

/**
 * Every env var the server cannot run without. Checked together, up front,
 * so a misconfigured environment fails once with a full list instead of
 * dying on whichever var happens to be read first (mid-import, with a
 * stack trace pointing at an unrelated module).
 */
const REQUIRED_ENV_VARS = [
  "PORT",
  "DATABASE_URL",
  "APP_URL",
  "BASE_PATH",
  "STATIC_DIR",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
] as const;

/**
 * Messages for vars whose failure mode isn't self-explanatory from the name
 * alone — shown instead of the generic "Missing required environment
 * variable" message. S3_REGION and S3_ENDPOINT in particular used to be
 * optional and silently default to AWS us-east-1 (see objectStorageS3.ts),
 * which is wrong for Cloudflare R2, Backblaze B2, Oracle Cloud Object
 * Storage, MinIO, etc. and previously only failed confusingly at upload
 * time. Require them explicitly so a missing/wrong provider config fails at
 * boot instead.
 */
const REQUIRED_ENV_VAR_MESSAGES: Partial<Record<string, string>> = {
  APP_URL:
    "Missing required environment variable: APP_URL (e.g. https://your-app.example.com — used for CORS, Clerk authorized parties, and OAuth redirect URIs)",
  BASE_PATH:
    'Missing required environment variable: BASE_PATH (required at build time by the frontend\'s Vite config; use "/" unless the app is served from a sub-path)',
  STATIC_DIR:
    "Missing required environment variable: STATIC_DIR (e.g. artifacts/groundworkos/dist/public — tells the API server where to serve the built frontend from)",
  S3_REGION:
    'Missing required environment variable: S3_REGION. This does NOT default to your provider\'s region — an unset S3_REGION silently falls back to AWS "us-east-1", which is wrong for Cloudflare R2, Backblaze B2, Oracle Cloud Object Storage, MinIO, etc., and fails confusingly at upload time rather than at boot. Set it to the region value your object storage provider expects.',
  S3_ENDPOINT:
    "Missing required environment variable: S3_ENDPOINT. This does NOT default to your provider's endpoint — an unset S3_ENDPOINT silently falls back to the AWS S3 default, which is wrong for Cloudflare R2, Backblaze B2, Oracle Cloud Object Storage, MinIO, etc., and fails confusingly at upload time rather than at boot. Set it to your provider's S3-compatible endpoint URL.",
};

/**
 * A Clerk publishable key is `pk_(test|live)_` followed by the base64
 * encoding of `<frontend-api-hostname>$` (see also csp.ts, which decodes
 * this at runtime to build the CSP header). A key that's merely
 * non-empty — a secret key pasted into the wrong variable, a truncated
 * copy-paste, a stray quote character — passes the old "is it set" check
 * but makes every Clerk SDK call fail silently, taking every route down
 * (including /healthz) with nothing logged to explain why. Validate the
 * shape here so a bad key fails loudly at boot instead.
 */
const PUBLISHABLE_KEY_RE = /^pk_(test|live)_(.+)$/;
const BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const HOSTNAME_RE =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
const SECRET_KEY_RE = /^sk_(test|live)_[A-Za-z0-9]+$/;

export function isValidPublishableKey(value: string): boolean {
  const match = PUBLISHABLE_KEY_RE.exec(value);
  if (!match) return false;

  const body = match[2];
  if (!BASE64_RE.test(body)) return false;

  const decoded = Buffer.from(body, "base64").toString("utf-8");
  if (!decoded.endsWith("$")) return false;

  return HOSTNAME_RE.test(decoded.slice(0, -1));
}

export function isValidSecretKey(value: string): boolean {
  return SECRET_KEY_RE.test(value);
}

const CLERK_MANIFEST_FILENAME = "clerk-manifest.json";

export type ClerkManifestResult =
  | { status: "absent" }
  | { status: "invalid" }
  | { status: "ok"; publishableKey: string };

/**
 * Reads the manifest the frontend build writes next to its output
 * (artifacts/groundworkos/vite.config.ts), recording the
 * VITE_CLERK_PUBLISHABLE_KEY that build was actually given. "Absent" is
 * expected, not an error: local dev and API-only runs never build the
 * frontend, so STATIC_DIR may point at a directory with no manifest at all.
 */
export function readClerkManifest(staticDir: string): ClerkManifestResult {
  const manifestPath = path.join(
    path.resolve(staticDir),
    CLERK_MANIFEST_FILENAME,
  );

  let raw: string;
  try {
    raw = fs.readFileSync(manifestPath, "utf-8");
  } catch {
    return { status: "absent" };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const key = (parsed as { publishableKey?: unknown } | null)?.publishableKey;
    if (typeof key === "string" && key.length > 0) {
      return { status: "ok", publishableKey: key };
    }
    return { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

function maskPublishableKey(key: string): string {
  return key.length <= 12 ? key : `${key.slice(0, 12)}…`;
}

/**
 * The frontend (VITE_CLERK_PUBLISHABLE_KEY, inlined at build time) and this
 * server (CLERK_PUBLISHABLE_KEY, read at runtime) each get the Clerk
 * publishable key from a different env var, and nothing else compares them.
 * If an operator sets a pk_test in one and a pk_live in the other, this
 * server's CSP (see csp.ts) ends up allow-listing a different Clerk
 * Frontend API origin than the one the bundle actually loads its SDK from,
 * so the browser blocks that script and the app renders a blank page with
 * nothing logged here. Comparing the two at boot turns that into a loud,
 * immediate failure instead.
 *
 * Returns an error message when the keys disagree, or null when they match
 * or the check can't be performed (no STATIC_DIR, no manifest, no server
 * key to compare against) - those cases are logged as warnings by the
 * caller, not treated as failures.
 */
export function checkClerkPublishableKeysMatch(
  staticDir: string | undefined,
  serverPublishableKey: string | undefined,
): string | null {
  if (!staticDir) return null;

  const manifest = readClerkManifest(staticDir);

  if (manifest.status === "absent") {
    logger.warn(
      `No ${CLERK_MANIFEST_FILENAME} found under STATIC_DIR ("${staticDir}") - skipping the ` +
        "CLERK_PUBLISHABLE_KEY / VITE_CLERK_PUBLISHABLE_KEY consistency check. Expected if the " +
        "frontend hasn't been built yet, or this is an API-only run.",
    );
    return null;
  }

  if (manifest.status === "invalid") {
    logger.warn(
      `Could not read ${CLERK_MANIFEST_FILENAME} under STATIC_DIR ("${staticDir}") - skipping the ` +
        "CLERK_PUBLISHABLE_KEY / VITE_CLERK_PUBLISHABLE_KEY consistency check.",
    );
    return null;
  }

  if (
    !serverPublishableKey ||
    manifest.publishableKey === serverPublishableKey
  ) {
    return null;
  }

  return (
    "CLERK_PUBLISHABLE_KEY does not match the VITE_CLERK_PUBLISHABLE_KEY the frontend was built " +
    `with (server: "${maskPublishableKey(serverPublishableKey)}", frontend build: ` +
    `"${maskPublishableKey(manifest.publishableKey)}"). These must be the exact same Clerk ` +
    "publishable key - the server derives its Content-Security-Policy from CLERK_PUBLISHABLE_KEY, " +
    "and a mismatch makes the browser block the Clerk script the frontend bundle actually loads, " +
    "with nothing logged server-side to explain the resulting blank page. Set both variables to " +
    "the identical value and rebuild the frontend."
  );
}

const errors: string[] = [];

for (const name of REQUIRED_ENV_VARS) {
  if (!process.env[name]) {
    errors.push(
      REQUIRED_ENV_VAR_MESSAGES[name] ??
        `Missing required environment variable: ${name}`,
    );
  }
}

const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
if (publishableKey && !isValidPublishableKey(publishableKey)) {
  errors.push(
    'Invalid CLERK_PUBLISHABLE_KEY: expected "pk_test_" or "pk_live_" followed by base64 that decodes to a hostname ending in "$" (e.g. pk_test_<base64("your-app.clerk.accounts.dev$")>)',
  );
}

const clerkKeyMismatch = checkClerkPublishableKeysMatch(
  process.env.STATIC_DIR,
  publishableKey,
);
if (clerkKeyMismatch) {
  errors.push(clerkKeyMismatch);
}

const secretKey = process.env.CLERK_SECRET_KEY;
if (secretKey && !isValidSecretKey(secretKey)) {
  errors.push(
    'Invalid CLERK_SECRET_KEY: expected "sk_test_" or "sk_live_" followed by the key value',
  );
}

/**
 * Optional: only relevant if the Clerk webhook (routes/clerk_webhook.ts) is
 * in use for the SIGNUP_ALLOWED_EMAIL_DOMAINS backstop. Not in
 * REQUIRED_ENV_VARS since most deployments rely on Clerk Dashboard
 * Restrictions alone and never set it.
 */
const WEBHOOK_SIGNING_SECRET_RE = /^whsec_.+$/;
const webhookSigningSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
if (
  webhookSigningSecret &&
  !WEBHOOK_SIGNING_SECRET_RE.test(webhookSigningSecret)
) {
  errors.push(
    'Invalid CLERK_WEBHOOK_SIGNING_SECRET: expected "whsec_" followed by the signing secret value',
  );
}

/**
 * If SIGNUP_ALLOWED_EMAIL_DOMAINS is set, the Clerk webhook
 * (routes/clerk_webhook.ts) can't enforce it without
 * CLERK_WEBHOOK_SIGNING_SECRET to verify incoming webhook signatures - the
 * allowlist would silently never apply. That combination used to only log a
 * warning at boot, which is easy to miss in a log stream; fail loudly
 * instead.
 */
const allowedDomains = parseAllowedDomains(
  process.env.SIGNUP_ALLOWED_EMAIL_DOMAINS,
);
if (allowedDomains.length > 0 && !process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
  errors.push(
    "SIGNUP_ALLOWED_EMAIL_DOMAINS is set but CLERK_WEBHOOK_SIGNING_SECRET is not - " +
      "incoming webhooks can't be verified, so the domain allowlist would never be enforced. " +
      "Set CLERK_WEBHOOK_SIGNING_SECRET or unset SIGNUP_ALLOWED_EMAIL_DOMAINS.",
  );
}

if (errors.length > 0) {
  for (const error of errors) {
    logger.error(error);
  }
  process.exit(1);
}
