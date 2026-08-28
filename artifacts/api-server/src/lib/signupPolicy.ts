/**
 * Sign-up restriction, enforced synchronously in routes/admin.ts's
 * POST /admin/invitations. GroundworkOS is invite-only end to end - the
 * only way a Better Auth user is ever created is via an admin-issued
 * invitation (see routes/admin.ts's POST /invitations/accept) - so
 * SIGNUP_ALLOWED_EMAIL_DOMAINS, when set, is checked against the invited
 * email address at invite-creation time, before any invitation (and
 * therefore before any account) exists.
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
