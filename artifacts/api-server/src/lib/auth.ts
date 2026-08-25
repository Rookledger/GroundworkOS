import type { Context, MiddlewareHandler } from "hono";
import { getAuth } from "@hono/clerk-auth";
import { type Role, ROLE_RANK, resolveRole } from "@workspace/shared-role";
import type { AppEnv } from "../types";

export type { Role };

/**
 * Reads (and caches, per-request) the caller's effective role.
 *
 * `c.get("userId")` is populated by the top-level requireAuth middleware in
 * routes/index.ts; `getAuth(c)` (from @hono/clerk-auth) is the fallback,
 * matching the old Express version's `req.userId ?? auth.userId`.
 */
export async function getUserRole(c: Context<AppEnv>): Promise<Role> {
  const cached = c.get("_role");
  if (cached) return cached;

  const auth = getAuth(c);
  const userId = c.get("userId") ?? auth?.userId ?? undefined;
  // Users with no explicit role default to foreman (lowest privilege), so a
  // stranger who reaches a public sign-up page never lands with elevated
  // access. An explicitly-set role always takes precedence. The first admin
  // is created via the one-time bootstrap flow in routes/admin.ts, not via
  // this default.
  let role: Role = "foreman";
  if (userId) {
    // A Clerk lookup failure is intentionally NOT swallowed here. Falling
    // back to "admin" on error would let an explicitly-demoted
    // manager/foreman silently gain admin during a transient Clerk outage
    // (fail-open privilege escalation). Let it throw so requireRole can fail
    // closed with a 503.
    const user = await c.get("clerk").users.getUser(userId);
    role = resolveRole(user.publicMetadata?.role);
  }
  c.set("_role", role);
  return role;
}

/**
 * Hono middleware factory: rejects the request with 403 unless the caller's
 * role is at least `minRole` (admin > manager > foreman).
 */
export function requireRole(minRole: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    let role: Role;
    try {
      role = await getUserRole(c);
    } catch {
      // Fail closed: if the caller's role can't be verified (e.g. a Clerk
      // outage), deny the request rather than assuming the default admin
      // role.
      return c.json(
        { error: "Unable to verify permissions, please try again" },
        503,
      );
    }
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      return c.json({ error: `Forbidden: ${minRole} role required` }, 403);
    }
    return next();
  };
}
