import type { Context, MiddlewareHandler } from "hono";
import { type Role, ROLE_RANK, resolveRole } from "@workspace/shared-role";
import type { AppEnv } from "../types";

export type { Role };

/**
 * Reads the caller's effective role.
 *
 * The top-level session middleware in app.ts sets both `userId` and `_role`
 * together, straight off the session's own D1-backed user row, whenever a
 * valid Better Auth session exists - so by the time any route handler runs,
 * `_role` is already set if `userId` is. This is now just a plain read of
 * that cached value, with no separate async lookup: unlike the old
 * Clerk-backed version, there is no external API call here that can fail
 * independently of the session lookup itself, so there's nothing left to
 * fail closed on.
 *
 * Users with no explicit role default to foreman (lowest privilege), so a
 * stranger with no session at all never resolves to anything higher. The
 * first admin is created via the one-time bootstrap flow in
 * routes/admin.ts, not via this default.
 */
export function getUserRole(c: Context<AppEnv>): Role {
  return c.get("_role") ?? "foreman";
}

/**
 * Hono middleware factory: rejects the request with 403 unless the caller's
 * role is at least `minRole` (admin > manager > foreman).
 */
export function requireRole(minRole: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const role = getUserRole(c);
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      return c.json({ error: `Forbidden: ${minRole} role required` }, 403);
    }
    return next();
  };
}

// resolveRole re-exported for callers (e.g. admin.ts) that need to resolve a
// raw role value read directly off a D1 row rather than off the context.
export { resolveRole };
