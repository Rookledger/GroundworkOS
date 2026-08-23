import type { Request, RequestHandler, Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { type Role, ROLE_RANK, resolveRole } from "@workspace/shared-role";

export type { Role };

declare global {
  // Standard pattern for augmenting Express's Request type (see @types/express).
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Per-request role cache, set by getUserRole so repeated calls within
       * the same request don't re-hit Clerk. */
      _role?: Role;
      /** Populated by the top-level requireAuth middleware in routes/index.ts. */
      userId?: string;
    }
  }
}

export async function getUserRole(req: Request): Promise<Role> {
  const cached = req._role;
  if (cached) return cached;

  const auth = getAuth(req);
  const userId = req.userId ?? auth.userId ?? undefined;
  // Users with no explicit role default to foreman (lowest privilege), so a
  // stranger who reaches a public sign-up page never lands with elevated
  // access. An explicitly-set role always takes precedence. The first admin
  // is created via the one-time bootstrap flow in routes/admin.ts, not via
  // this default.
  let role: Role = "foreman";
  if (userId) {
    // A Clerk lookup failure is intentionally NOT swallowed here. Falling back
    // to "admin" on error would let an explicitly-demoted manager/foreman
    // silently gain admin during a transient Clerk outage (fail-open privilege
    // escalation). Let it throw so requireRole can fail closed with a 503.
    const user = await clerkClient.users.getUser(userId);
    role = resolveRole(user.publicMetadata?.role);
  }
  req._role = role;
  return role;
}

/**
 * Express middleware factory: rejects the request with 403 unless the
 * caller's role is at least `minRole` (admin > manager > foreman).
 *
 * Generic over the route's param/body/query types so TypeScript unifies it
 * with the concrete handler it's paired with in `router.METHOD(path, requireRole(...), handler)`
 * instead of falling back to a broader default `ParamsDictionary`.
 */
export function requireRole<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any,
>(minRole: Role): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return async (req, res, next) => {
    let role: Role;
    try {
      role = await getUserRole(req as unknown as Request);
    } catch {
      // Fail closed: if the caller's role can't be verified (e.g. a Clerk
      // outage), deny the request rather than assuming the default admin role.
      // Cast to the base Response type: this error body doesn't conform to
      // the route's generic ResBody, which is fine since we're short-circuiting
      // before the route handler ever runs.
      (res as Response).status(503).json({
        error: "Unable to verify permissions, please try again",
      });
      return;
    }
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      (res as Response).status(403).json({
        error: `Forbidden: ${minRole} role required`,
      });
      return;
    }
    next();
  };
}
