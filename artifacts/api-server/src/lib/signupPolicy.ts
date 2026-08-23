/**
 * Optional defense-in-depth for sign-up restriction, used by
 * routes/clerk_webhook.ts. The primary control lives in the Clerk Dashboard
 * (Restrictions -> sign-up mode = Restricted, and/or its own allowlist),
 * which stops an account from ever being created. SIGNUP_ALLOWED_EMAIL_DOMAINS
 * is a server-side backstop for that same rule, checked after the fact
 * against whichever account Clerk did create.
 */

/** Parses the comma-separated SIGNUP_ALLOWED_EMAIL_DOMAINS env var into a
 * normalized list. An unset or empty value means the check is disabled. */
export function parseAllowedDomains(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

/** True if `email`'s domain is in `allowedDomains`, or if the allowlist is
 * empty (i.e. the check is disabled). */
export function emailDomainAllowed(
  email: string,
  allowedDomains: string[],
): boolean {
  if (allowedDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && allowedDomains.includes(domain);
}
