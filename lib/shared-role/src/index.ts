/**
 * Shared Role type, rank table, and role-resolution rules.
 *
 * Roles are stored in Clerk publicMetadata.role and are read independently
 * on the frontend (hooks/useRole.ts) and backend (lib/auth.ts, routes/admin.ts).
 * This module is the single source of truth for the Role type and the
 * "no explicit role defaults to foreman" rule - any change here applies
 * everywhere it's imported, since a mismatch between frontend and backend
 * checks has been a real bug source.
 *
 * Because the default is the lowest-privilege role, nobody ever gets admin
 * just by signing up. The one-time bootstrap flow in routes/admin.ts
 * (adminExists / POST /admin/bootstrap) is how the very first admin is
 * created instead - see that file for details.
 */

export type Role = "foreman" | "manager" | "admin";

/** Rank order so callers can compare roles, e.g. admin > manager > foreman. */
export const ROLE_RANK: Record<Role, number> = {
  foreman: 0,
  manager: 1,
  admin: 2,
};
/** True if `value` is one of the three valid Role strings. */
export function isRole(value: unknown): value is Role {
  return value === "admin" || value === "manager" || value === "foreman";
}

/**
 * Resolves a raw, possibly-missing/unrecognized role value (e.g. read
 * straight off Clerk publicMetadata.role) to a concrete Role: a recognized
 * value is used as-is, anything else (missing, or unrecognized) resolves to
 * foreman, the lowest-privilege role. This is the "no explicit role defaults
 * to foreman" rule - so a stranger reaching a public sign-up page never
 * lands with admin access - used to compute a user's effective role for
 * access checks.
 */
export function resolveRole(claimed: unknown): Role {
  return isRole(claimed) ? claimed : "foreman";
}
