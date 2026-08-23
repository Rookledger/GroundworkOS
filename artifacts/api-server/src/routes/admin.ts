import { Router } from "express";
import { clerkClient } from "@clerk/express";
import type { User } from "@clerk/backend";
import { isRole, resolveRole } from "@workspace/shared-role";
import { logger } from "../lib/logger";

const router = Router();

// --- Shared helpers ---

/** Reads the authenticated Clerk user id off the request, or null if signed out. */
function getUserId(req: any): string | null {
  return req.userId ?? req.auth?.userId ?? null;
}

/**
 * Optional lockdown for the bootstrap escape hatch below. Left unset,
 * POST /admin/bootstrap grants admin to whichever signed-in user calls it
 * first on an admin-less workspace - fine as a one-time setup step on a
 * workspace nobody else can reach yet, but a land grab if the service is
 * already publicly reachable with Clerk sign-up Restrictions still open:
 * whoever signs up first can also bootstrap first and permanently own the
 * instance. Setting BOOTSTRAP_ADMIN_EMAIL restricts that first grab to a
 * single known email address, matched case-insensitively against the
 * caller's primary Clerk email address. See RAILWAY.md Step 5 for the
 * recommended primary control: setting Clerk Dashboard -> Restrictions to
 * "Restricted" BEFORE the service is publicly reachable at all.
 */
export const BOOTSTRAP_ADMIN_EMAIL =
  process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || null;

if (!BOOTSTRAP_ADMIN_EMAIL) {
  logger.warn(
    "BOOTSTRAP_ADMIN_EMAIL is not set - POST /admin/bootstrap will grant admin to whichever " +
      "signed-in user calls it first on this admin-less workspace. Set Clerk Dashboard -> " +
      'Restrictions to "Restricted" BEFORE this service is publicly reachable, or set ' +
      "BOOTSTRAP_ADMIN_EMAIL to lock the bootstrap route to one known email address.",
  );
}

/**
 * Clerk's max page size for getUserList. adminExists() and findAdmins()
 * below page through the full user list in chunks of this size rather than
 * fetching a single page, so a workspace can grow past this many users
 * without the admin check silently only looking at the first page.
 */
const USER_LIST_PAGE_SIZE = 500;

/**
 * Pages through every Clerk user, calling `onUser` for each one in
 * creation order. Stops as soon as `onUser` returns true for some user
 * (without fetching further pages); otherwise pages until Clerk's
 * `totalCount` is exhausted. This is the only place that calls
 * getUserList for admin-detection purposes - adminExists() and
 * findAdmins() are both thin wrappers around it, so there is exactly one
 * place that has to get pagination right.
 */
async function forEachUser(
  onUser: (user: User) => boolean | void,
): Promise<void> {
  let offset = 0;
  for (;;) {
    const response = await clerkClient.users.getUserList({
      limit: USER_LIST_PAGE_SIZE,
      offset,
    });
    for (const user of response.data) {
      if (onUser(user) === true) return;
    }
    offset += response.data.length;
    // Defend against an infinite loop if Clerk ever returns an empty page
    // with a stale/incorrect totalCount instead of a genuinely exhausted list.
    if (response.data.length === 0 || offset >= response.totalCount) return;
  }
}

/**
 * True if the workspace already has an effective admin.
 *
 * Role resolution across the app treats a user with NO explicit role as a
 * foreman (see getUserRole in lib/auth.ts), so a brand-new signup is never
 * counted as an admin here. Only a user with an explicit "admin" role in
 * Clerk publicMetadata counts. This is what lets the bootstrap flow below
 * unlock exactly once, on a genuinely admin-less workspace, and stay locked
 * afterwards.
 *
 * Pages through the *entire* user list (see forEachUser) rather than a
 * single page - a workspace with more than USER_LIST_PAGE_SIZE users used
 * to be able to have its one and only admin fall outside a single 500-user
 * page, which made this function return false and silently re-open
 * bootstrap on a live workspace. Still cheap in the common case: it stops
 * at the first admin found instead of always walking every user.
 */
export async function adminExists(): Promise<boolean> {
  let found = false;
  await forEachUser((user) => {
    if (resolveRole(user.publicMetadata?.role) === "admin") {
      found = true;
      return true;
    }
    return false;
  });
  return found;
}

/**
 * Every user currently holding an explicit "admin" role, with just enough
 * detail (id, updatedAt) to break a tie deterministically. Unlike
 * adminExists(), this cannot stop early - it needs the *whole* set of
 * admins to detect a bootstrap race (see the TOCTOU comment in POST
 * /admin/bootstrap below), so it always pages through every user.
 */
async function findAdmins(): Promise<Pick<User, "id" | "updatedAt">[]> {
  const admins: Pick<User, "id" | "updatedAt">[] = [];
  await forEachUser((user) => {
    if (resolveRole(user.publicMetadata?.role) === "admin") {
      admins.push({ id: user.id, updatedAt: user.updatedAt });
    }
    return false;
  });
  return admins;
}

/**
 * Guards a route to admins only. Responds with 401/403 and returns false if
 * the caller isn't an admin, so the route handler can `if (!(await
 * requireAdmin(req, res))) return;` and stop early.
 */
async function requireAdmin(req: any, res: any): Promise<boolean> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const user = await clerkClient.users.getUser(userId);
  // Users with no explicit role default to foreman; only an explicit
  // "admin" role passes here.
  if (resolveRole(user.publicMetadata?.role) !== "admin") {
    res.status(403).json({ error: "Forbidden: admin role required" });
    return false;
  }
  return true;
}

// --- User management (admin only) ---

router.get("/admin/users", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const response = await clerkClient.users.getUserList({ limit: 100 });
    const users = response.data.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.emailAddresses[0]?.emailAddress ?? null,
      role: resolveRole(u.publicMetadata?.role),
      imageUrl: u.imageUrl,
      createdAt: new Date(u.createdAt).toISOString(),
      lastSignInAt: u.lastSignInAt
        ? new Date(u.lastSignInAt).toISOString()
        : null,
    }));
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to fetch users" });
  }
});

router.patch("/admin/users/:id/role", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { role } = req.body;
  if (!isRole(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  try {
    await clerkClient.users.updateUserMetadata(req.params.id, {
      publicMetadata: { role },
    });
    return res.json({ ok: true });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message ?? "Failed to update role" });
  }
});

// --- Invitations (admin only) ---
//
// GroundworkOS is a single-company, invite-only instance (see Clerk
// Dashboard -> Restrictions, where public sign-up is disabled). This is the
// in-app way for an admin to actually invite a teammate instead of using the
// Clerk Dashboard directly. The invited role is stamped into the
// invitation's publicMetadata, which Clerk copies onto the user's own
// publicMetadata once they accept and sign up - so a newly-invited teammate
// already has the right role from their very first sign-in.

router.get("/admin/invitations", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const response = await clerkClient.invitations.getInvitationList({
      status: "pending",
      orderBy: "-created_at",
    });
    const invitations = response.data.map((inv) => ({
      id: inv.id,
      email: inv.emailAddress,
      role: resolveRole(
        (inv.publicMetadata as Record<string, unknown> | null)?.role,
      ),
      createdAt: new Date(inv.createdAt).toISOString(),
    }));
    res.json(invitations);
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err.message ?? "Failed to fetch invitations" });
  }
});

router.post("/admin/invitations", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { email, role } = req.body;
  if (typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email address is required" });
  }
  if (!isRole(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  try {
    await clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role },
      notify: true,
    });
    return res.json({ ok: true });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message ?? "Failed to send invitation" });
  }
});

router.delete("/admin/invitations/:id", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    await clerkClient.invitations.revokeInvitation(req.params.id);
    return res.json({ ok: true });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message ?? "Failed to revoke invitation" });
  }
});

// --- First-time admin bootstrap ---
//
// Unset roles now default to foreman (the lowest privilege), so nobody -
// including the very first person to sign up - ever gets admin just by
// being unset. That means a brand-new deployment starts with zero admins,
// and the "admin only" guard above would lock everyone out of user
// management forever with no way to ever grant the first admin role.
// These two endpoints are the documented, explicit path around that:
// any signed-in user may check whether an admin exists yet
// (GET /admin/bootstrap-status), and may promote *themselves* to admin by
// writing an explicit publicMetadata.role = "admin" (POST /admin/bootstrap),
// but only while the workspace still has none. Once any user has an
// explicit "admin" role, bootstrap permanently stops working (adminExists()
// above returns true) and role changes must go through the admin-only
// endpoint above. This is a one-time, explicit self-promotion - it does not
// rely on, or interact with, the unset-role default in any way.
//
// Two things this can't fix on its own, and how they're handled:
//
// - Land grab: on an admin-less workspace, this route grants admin to
//   whichever signed-in user calls it first - there's no way for the server
//   to know who the "real" operator is. If BOOTSTRAP_ADMIN_EMAIL is set,
//   POST /admin/bootstrap is restricted to that one email address; if
//   unset, a boot-time warning is logged (see above) and the primary
//   defense is Clerk Dashboard -> Restrictions, set to "Restricted" before
//   the service is ever publicly reachable (RAILWAY.md Step 5).
// - TOCTOU: the adminExists() check and the metadata write below are two
//   separate Clerk API calls, not one atomic operation, so two concurrent
//   callers can both observe "no admin" and both write "admin" before
//   either write is visible to the other's check. Clerk's API has no
//   compare-and-swap for metadata, so POST /admin/bootstrap re-checks
//   immediately after writing and has the loser of the race demote itself
//   back - see the comment inline below.

router.get("/admin/bootstrap-status", async (req, res) => {
  if (!getUserId(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    return res.json({ adminExists: await adminExists() });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message ?? "Failed to check admin status" });
  }
});

const ALREADY_BOOTSTRAPPED_ERROR = {
  error:
    "An admin already exists. Ask them to promote you from Settings > Users.",
};

router.post("/admin/bootstrap", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const caller = await clerkClient.users.getUser(userId);

    if (BOOTSTRAP_ADMIN_EMAIL) {
      const callerEmail =
        caller.primaryEmailAddress?.emailAddress?.toLowerCase();
      if (callerEmail !== BOOTSTRAP_ADMIN_EMAIL) {
        return res.status(403).json({
          error:
            "Bootstrap is restricted to a specific admin email for this workspace. " +
            "Ask that person to sign in and bootstrap, or ask an existing admin to promote you.",
        });
      }
    }

    if (await adminExists()) {
      return res.status(409).json(ALREADY_BOOTSTRAPPED_ERROR);
    }

    // The role this user held before bootstrapping - used to restore it if
    // this call turns out to have lost the TOCTOU race just below, rather
    // than unconditionally dropping the loser to foreman.
    const priorRole = resolveRole(caller.publicMetadata?.role);

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { role: "admin" },
    });

    // TOCTOU guard: the adminExists() check above and this write are not
    // atomic, so two concurrent callers can both have observed "no admin"
    // and both reach this point. Clerk's API has no compare-and-swap for
    // metadata, so the best available fix is a re-check immediately after
    // writing: list every admin that exists now. If more than one shows up,
    // this was a race - deterministically pick a single winner (earliest
    // updatedAt, ties broken by the lower user id, so every caller in the
    // race picks the same winner from the same data) and have every other
    // caller demote itself back to its prior role and report the same
    // "already exists" error a caller who simply lost the race would see.
    const admins = await findAdmins();
    if (admins.length > 1) {
      const winner = admins.reduce((a, b) =>
        a.updatedAt !== b.updatedAt
          ? a.updatedAt < b.updatedAt
            ? a
            : b
          : a.id < b.id
            ? a
            : b,
      );
      if (winner.id !== userId) {
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: { role: priorRole },
        });
        return res.status(409).json(ALREADY_BOOTSTRAPPED_ERROR);
      }
    }

    return res.json({ ok: true });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message ?? "Failed to bootstrap admin" });
  }
});

export default router;
