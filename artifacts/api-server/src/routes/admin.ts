import { Hono } from "hono";
import type { Context } from "hono";
import { eq, sql } from "drizzle-orm";
import { userTable, invitationsTable } from "@workspace/db";
import { isRole, resolveRole } from "@workspace/shared-role";
import { emailDomainAllowed, parseAllowedDomains } from "../lib/signupPolicy.js";
import { createAuth } from "../lib/betterAuth.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

// --- Shared helpers ---

/** Reads the authenticated user id off the request, or null if signed out. */
function getUserId(c: Context<AppEnv>): string | null {
  return c.get("userId") ?? null;
}

/**
 * Optional lockdown for the bootstrap escape hatch below. Left unset,
 * POST /admin/bootstrap grants admin to whichever signed-in user calls it
 * first on an admin-less workspace - fine as a one-time setup step on a
 * workspace nobody else can reach yet, but a land grab if the service is
 * already publicly reachable: whoever accepts an invitation first (or, on a
 * misconfigured deployment, whoever otherwise gets a session first) can also
 * bootstrap first and permanently own the instance. Setting
 * BOOTSTRAP_ADMIN_EMAIL restricts that first grab to a single known email
 * address, matched case-insensitively against the caller's own email.
 *
 * Unlike the original Express version, this can't be read and warned about
 * once at process startup - Workers have no module-level env, only
 * per-request c.env - so bootstrapAdminEmail() below reads it fresh on each
 * bootstrap call, and the "not set" warning (if any) is logged there too.
 */
function bootstrapAdminEmail(c: Context<AppEnv>): string | null {
  return c.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || null;
}

/**
 * True if the workspace already has an effective admin.
 *
 * Role resolution across the app treats a user with NO explicit role as a
 * foreman (see getUserRole in lib/auth.ts), so a brand-new signup is never
 * counted as an admin here. Only a user with an explicit "admin" role in
 * the `user.role` D1 column counts. This is what lets the bootstrap flow
 * below unlock exactly once, on a genuinely admin-less workspace, and stay
 * locked afterwards.
 */
export async function adminExists(c: Context<AppEnv>): Promise<boolean> {
  const [row] = await c
    .get("db")
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.role, "admin"))
    .limit(1);
  return !!row;
}

/**
 * Every user currently holding an explicit "admin" role, with just enough
 * detail (id, updatedAt) to break a tie deterministically. Used by the
 * TOCTOU guard in attemptBootstrap() below.
 */
async function findAdmins(
  c: Context<AppEnv>,
): Promise<Pick<typeof userTable.$inferSelect, "id" | "updatedAt">[]> {
  return c
    .get("db")
    .select({ id: userTable.id, updatedAt: userTable.updatedAt })
    .from(userTable)
    .where(eq(userTable.role, "admin"));
}

/**
 * Guards a route to admins only. Returns null (having already written the
 * 401/403 response) if the caller isn't an admin, so the route handler can
 * `const denied = await requireAdmin(c); if (denied) return denied;`.
 */
async function requireAdmin(c: Context<AppEnv>): Promise<Response | null> {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  // The session middleware (app.ts) already sets `_role` alongside
  // `userId` for every request with a valid session, so this is normally
  // just a cache read - the DB fallback only matters for a route that
  // somehow reaches here without going through that middleware.
  let role = c.get("_role");
  if (!role) {
    const [row] = await c
      .get("db")
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    role = resolveRole(row?.role);
  }
  if (role !== "admin") {
    return c.json({ error: "Forbidden: admin role required" }, 403);
  }
  return null;
}

// --- User management (admin only) ---

router.get("/admin/users", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  try {
    const rows = await c
      .get("db")
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
        image: userTable.image,
        createdAt: userTable.createdAt,
      })
      .from(userTable);
    const users = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: resolveRole(u.role),
      image: u.image,
      createdAt: new Date(u.createdAt).toISOString(),
    }));
    return c.json(users);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to fetch users" },
      500,
    );
  }
});

router.patch("/admin/users/:id/role", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const { role } = await c.req.json();
  if (!isRole(role)) {
    return c.json({ error: "Invalid role" }, 400);
  }
  try {
    await c
      .get("db")
      .update(userTable)
      .set({ role, updatedAt: new Date() })
      .where(eq(userTable.id, c.req.param("id")));
    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to update role" },
      500,
    );
  }
});

// --- Invitations (admin only) ---
//
// GroundworkOS is a single-company, invite-only instance: the only way an
// account is ever created is via an invitation issued here and accepted
// through POST /invitations/accept below. The public sign-up HTTP route is
// blocked at the app.ts layer (see that file's comment above its handler
// for /api/auth/sign-up/email).

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

router.get("/admin/invitations", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  try {
    const rows = await c.get("db").select().from(invitationsTable);
    const now = Date.now();
    const pending = rows
      .filter((inv) => !inv.acceptedAt && inv.expiresAt.getTime() > now)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: resolveRole(inv.role),
        createdAt: inv.createdAt.toISOString(),
      }));
    return c.json(pending);
  } catch (err) {
    return c.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch invitations",
      },
      500,
    );
  }
});

router.post("/admin/invitations", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const { email, role } = await c.req.json();
  if (typeof email !== "string" || !email.includes("@")) {
    return c.json({ error: "A valid email address is required" }, 400);
  }
  if (!isRole(role)) {
    return c.json({ error: "Invalid role" }, 400);
  }

  const allowedDomains = parseAllowedDomains(c.env.SIGNUP_ALLOWED_EMAIL_DOMAINS);
  if (!emailDomainAllowed(email, allowedDomains)) {
    return c.json(
      { error: "This email domain is not allowed to be invited" },
      400,
    );
  }

  try {
    const invitedBy = getUserId(c);
    const now = new Date();
    const invitation = {
      id: crypto.randomUUID(),
      email,
      role,
      token: crypto.randomUUID(),
      invitedBy,
      createdAt: now,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      acceptedAt: null,
    };
    await c.get("db").insert(invitationsTable).values(invitation);

    const resendApiKey = c.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(resendApiKey);
        const acceptUrl = `${c.env.APP_URL ?? ""}/accept-invite?token=${invitation.token}`;
        await resend.emails.send({
          from: "onboarding@resend.dev",
          to: email,
          subject: "You're invited to GroundworkOS",
          html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#f0ede8;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fafaf8;border-radius:12px;overflow:hidden;border:1px solid #d9d4ce;">
    <div style="background:#1b5e78;padding:24px 28px;">
      <div style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:20px;color:#ffffff;">GroundworkOS</div>
    </div>
    <div style="padding:24px 28px;">
      <p style="color:#181410;font-size:15px;line-height:1.6;">You've been invited to join GroundworkOS as a <strong>${role}</strong>.</p>
      <p style="margin-top:20px;">
        <a href="${acceptUrl}" style="display:inline-block;padding:10px 20px;border-radius:6px;background:#1b5e78;color:#ffffff;text-decoration:none;font-family:'Space Grotesk',Arial,sans-serif;font-weight:600;">Accept invitation</a>
      </p>
      <p style="color:#7a7469;font-size:12px;margin-top:20px;">This invitation expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
        });
      } catch (emailErr) {
        // The invitation row is still created even if the email fails to
        // send - an admin can see it's pending and share the accept link
        // manually. Don't fail the whole request over a transient email
        // provider error.
        c.get("logger").warn(
          { err: emailErr },
          "Failed to send invitation email",
        );
      }
    }

    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      {
        error: err instanceof Error ? err.message : "Failed to send invitation",
      },
      500,
    );
  }
});

router.delete("/admin/invitations/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  try {
    await c
      .get("db")
      .delete(invitationsTable)
      .where(eq(invitationsTable.id, c.req.param("id")));
    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to revoke invitation",
      },
      500,
    );
  }
});

/**
 * Public (no session required - the person accepting doesn't have one yet).
 * Looks up the invitation by token, creates the Better Auth user
 * server-side via auth.api.signUpEmail (see app.ts for why the public
 * /api/auth/sign-up/email route is blocked at the HTTP layer instead of via
 * `emailAndPassword.disableSignUp` - that flag would break this call too),
 * then stamps the invited role directly with a follow-up Drizzle
 * update - the `role` additionalField's `input: false` (see
 * lib/betterAuth.ts) blocks a public caller from setting their own role
 * through signUpEmail's body, but this trusted server-side path is the one
 * place that's supposed to grant a specific invited role.
 */
router.post("/invitations/accept", async (c) => {
  const { token, name, password } = await c.req.json();
  if (
    typeof token !== "string" ||
    typeof name !== "string" ||
    typeof password !== "string" ||
    !name.trim() ||
    !password
  ) {
    return c.json({ error: "token, name and password are required" }, 400);
  }

  const db = c.get("db");
  const [invitation] = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.token, token));

  if (!invitation) {
    return c.json({ error: "Invitation not found" }, 404);
  }
  if (invitation.acceptedAt) {
    return c.json({ error: "This invitation has already been accepted" }, 400);
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return c.json({ error: "This invitation has expired" }, 400);
  }
  if (!isRole(invitation.role)) {
    return c.json({ error: "Invitation has an invalid role" }, 500);
  }

  try {
    const auth = createAuth(c.env);

    // Server-side calls into Better Auth's API throw on failure (an
    // APIError, with `.message`/`.status`) rather than returning an error
    // object, hence the try/catch around the whole flow.
    const signUpResult = await auth.api.signUpEmail({
      body: { email: invitation.email, password, name: name.trim() },
    });
    const userId = signUpResult.user?.id;
    if (!userId) {
      return c.json({ error: "Failed to create account" }, 500);
    }

    await db
      .update(userTable)
      .set({ role: invitation.role, updatedAt: new Date() })
      .where(eq(userTable.id, userId));

    await db
      .update(invitationsTable)
      .set({ acceptedAt: new Date() })
      .where(eq(invitationsTable.id, invitation.id));

    // Sign the caller in fresh (rather than trying to reuse whatever
    // session signUpEmail itself may or may not have started) now that the
    // invited role is already stamped onto the user row, so the resulting
    // session's own `role` field is correct from the very first response.
    // `asResponse: true` returns a real Fetch Response with the session's
    // `Set-Cookie` header already on it, which is returned to the caller
    // as-is so they're signed in immediately without a second round trip.
    const signInResponse = await auth.api.signInEmail({
      body: { email: invitation.email, password },
      asResponse: true,
    });
    return signInResponse;
  } catch (err) {
    return c.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to accept invitation",
      },
      500,
    );
  }
});

// --- Public sign-up (open only while the workspace has zero users) ---
//
// GroundworkOS's account model, past the very first account, is invite-only
// end to end (see the block above) - but something has to create that first
// account on a brand-new deployment, and asking the operator to hand-craft
// a D1 row isn't a real "sign up" flow. Rather than open unrestricted public
// registration, this exposes exactly one self-service registration surface,
// and it only ever works while the `user` table is completely empty. The
// instant a single account exists here - admin or not - userCount() below
// stops returning 0, both routes start refusing, and the workspace is
// invite-only from then on with no way back into this flow short of an
// admin issuing invitations (or, if every account were ever removed,
// emptying the table again).

/** Total number of users in the workspace, admin or otherwise. */
async function userCount(c: Context<AppEnv>): Promise<number> {
  const [row] = await c
    .get("db")
    .select({ count: sql<number>`count(*)` })
    .from(userTable);
  return Number(row?.count ?? 0);
}

/**
 * Public (no session required, and no invitation either - see above). Lets
 * the frontend decide whether to offer a "set up GroundworkOS" link on the
 * sign-in page without guessing: SignInPage only shows it while `open` is
 * true, which is exactly the same condition POST /setup/first-admin itself
 * enforces below, so the UI and the API can never disagree about whether
 * sign-up is currently available.
 */
router.get("/setup/status", async (c) => {
  try {
    return c.json({ open: (await userCount(c)) === 0 });
  } catch (err) {
    return c.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to check setup status",
      },
      500,
    );
  }
});

const ALREADY_SET_UP_ERROR = {
  error:
    "GroundworkOS is already set up. Ask an admin for an invitation instead.",
};

/**
 * Public (no session required - nobody has an account yet on a genuinely
 * empty workspace). Creates the very first account, the same way
 * POST /invitations/accept creates an invited one: via auth.api.signUpEmail
 * server-side (see app.ts for how the public sign-up route is kept closed
 * without disabling this call too), then a follow-up Drizzle update to
 * stamp the "admin" role - `role`'s `input: false` additionalField config
 * blocks a caller from granting themselves that role through signUpEmail's
 * body directly.
 */
router.post("/setup/first-admin", async (c) => {
  const { name, email, password } = await c.req.json();
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !name.trim() ||
    !email.includes("@") ||
    !password
  ) {
    return c.json({ error: "name, email and password are required" }, 400);
  }

  const allowedDomains = parseAllowedDomains(c.env.SIGNUP_ALLOWED_EMAIL_DOMAINS);
  if (!emailDomainAllowed(email, allowedDomains)) {
    return c.json({ error: "This email domain is not allowed to sign up" }, 400);
  }

  try {
    if ((await userCount(c)) > 0) {
      return c.json(ALREADY_SET_UP_ERROR, 409);
    }

    const auth = createAuth(c.env);
    const db = c.get("db");

    const signUpResult = await auth.api.signUpEmail({
      body: { email, password, name: name.trim() },
    });
    const userId = signUpResult.user?.id;
    if (!userId) {
      return c.json({ error: "Failed to create account" }, 500);
    }

    await db
      .update(userTable)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(userTable.id, userId));

    // TOCTOU guard, mirroring attemptBootstrap() below: the userCount()
    // check above and this account's creation are two separate D1
    // round-trips, not one atomic operation, so two concurrent callers can
    // both observe zero users and both reach this point, each creating its
    // own account. Re-list every admin that exists now and deterministically
    // pick a single winner (earliest updatedAt, ties broken by the lower
    // user id, so every caller in the race computes the same winner from
    // the same data). Every other caller's freshly-created account is
    // demoted back to the ordinary default role rather than deleted - it
    // doesn't vanish out from under the person who just chose its password,
    // and an existing admin can still see and manage it under
    // Settings > Users afterwards.
    const admins = await findAdmins(c);
    if (admins.length > 1) {
      const winner = admins.reduce((a, b) =>
        a.updatedAt.getTime() !== b.updatedAt.getTime()
          ? a.updatedAt.getTime() < b.updatedAt.getTime()
            ? a
            : b
          : a.id < b.id
            ? a
            : b,
      );
      if (winner.id !== userId) {
        await db
          .update(userTable)
          .set({ role: "foreman", updatedAt: new Date() })
          .where(eq(userTable.id, userId));
        return c.json(ALREADY_SET_UP_ERROR, 409);
      }
    }

    // Sign the caller in fresh, same as POST /invitations/accept does, now
    // that the admin role is already stamped onto the user row.
    const signInResponse = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    return signInResponse;
  } catch (err) {
    return c.json(
      {
        error: err instanceof Error ? err.message : "Failed to create account",
      },
      500,
    );
  }
});

// --- First-time admin bootstrap ---
//
// Unset roles default to foreman (the lowest privilege), so nobody - not
// even the very first person to accept an invitation - ever gets admin just
// by being unset. That means a brand-new deployment starts with zero
// admins, and the "admin only" guard above would lock everyone out of user
// management forever with no way to ever grant the first admin role.
// attemptBootstrap() below is the one place that grants it for a workspace
// that already has some non-admin users but none of them are admin yet
// (e.g. everyone signed up through an older build, or an admin account was
// removed): it promotes the *calling* user to admin, but only while the
// workspace still has none. POST /setup/first-admin above handles the more
// common case of a completely empty workspace; this is the fallback for
// "some users exist, but none are admin".
// Once any user has an explicit "admin" role, bootstrap permanently stops
// working (adminExists() above returns true) and role changes must go
// through the admin-only endpoint above. This does not rely on, or
// interact with, the unset-role default in any way.
//
// Two entry points call it:
// - GET /admin/bootstrap-status runs it automatically, best-effort, for
//   any signed-in non-admin caller on an admin-less workspace - see the
//   comment on that route below.
// - POST /admin/bootstrap runs it on explicit request, so the frontend's
//   "Make me admin" button (and anyone scripting against the API directly)
//   keeps working exactly as before, and callers get a real HTTP status
//   they can act on instead of having to poll bootstrap-status.
//
// Two things this can't fix on its own, and how they're handled:
//
// - Land grab: on an admin-less workspace, this grants admin to whichever
//   signed-in user is resolved first. If BOOTSTRAP_ADMIN_EMAIL is set,
//   bootstrap is restricted to that one email address; if unset, this route
//   logs a warning (see below).
// - TOCTOU: the adminExists() check and the role write below are two
//   separate D1 statements, not one atomic operation, so two concurrent
//   callers can both observe "no admin" and both write "admin" before
//   either write is visible to the other's check. attemptBootstrap()
//   re-checks immediately after writing and has the loser of the race
//   demote itself back - see the comment inline below.

const ALREADY_BOOTSTRAPPED_ERROR = {
  error:
    "An admin already exists. Ask them to promote you from Settings > Users.",
};

/**
 * Attempts to promote `userId` to admin on a genuinely admin-less
 * workspace. Never throws - D1 failures are caught and reported as a 500
 * result, same as every other route in this file, so both callers (the
 * explicit POST route and the automatic call from bootstrap-status) can
 * treat this as a plain result object instead of a try/catch.
 */
async function attemptBootstrap(
  c: Context<AppEnv>,
  userId: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const db = c.get("db");
    const [caller] = await db
      .select({ role: userTable.role, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, userId));

    const adminEmail = bootstrapAdminEmail(c);
    if (!adminEmail) {
      c.get("logger").warn(
        "BOOTSTRAP_ADMIN_EMAIL is not set - POST /admin/bootstrap will grant admin to whichever " +
          "signed-in user calls it first on this admin-less workspace. Set BOOTSTRAP_ADMIN_EMAIL " +
          "to lock the bootstrap route to one known email address.",
      );
    }

    if (adminEmail) {
      const callerEmail = caller?.email?.toLowerCase();
      if (callerEmail !== adminEmail) {
        return {
          status: 403,
          body: {
            error:
              "Bootstrap is restricted to a specific admin email for this workspace. " +
              "Ask that person to sign in and bootstrap, or ask an existing admin to promote you.",
          },
        };
      }
    }

    if (await adminExists(c)) {
      return { status: 409, body: ALREADY_BOOTSTRAPPED_ERROR };
    }

    // The role this user held before bootstrapping - used to restore it if
    // this call turns out to have lost the TOCTOU race just below, rather
    // than unconditionally dropping the loser to foreman.
    const priorRole = resolveRole(caller?.role);

    await db
      .update(userTable)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(userTable.id, userId));

    // TOCTOU guard: the adminExists() check above and this write are not
    // atomic, so two concurrent callers can both have observed "no admin"
    // and both reach this point. The best available fix is a re-check
    // immediately after writing: list every admin that exists now. If more
    // than one shows up, this was a race - deterministically pick a single
    // winner (earliest updatedAt, ties broken by the lower user id, so
    // every caller in the race picks the same winner from the same data)
    // and have every other caller demote itself back to its prior role and
    // report the same "already exists" error a caller who simply lost the
    // race would see.
    const admins = await findAdmins(c);
    if (admins.length > 1) {
      const winner = admins.reduce((a, b) =>
        a.updatedAt.getTime() !== b.updatedAt.getTime()
          ? a.updatedAt.getTime() < b.updatedAt.getTime()
            ? a
            : b
          : a.id < b.id
            ? a
            : b,
      );
      if (winner.id !== userId) {
        await db
          .update(userTable)
          .set({ role: priorRole, updatedAt: new Date() })
          .where(eq(userTable.id, userId));
        return { status: 409, body: ALREADY_BOOTSTRAPPED_ERROR };
      }
    }

    return { status: 200, body: { ok: true } };
  } catch (err) {
    return {
      status: 500,
      body: {
        error: err instanceof Error ? err.message : "Failed to bootstrap admin",
      },
    };
  }
}

router.get("/admin/bootstrap-status", async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    // Auto-bootstrap: UsersPage calls this route for any signed-in,
    // non-admin user as soon as they open Settings -> Users, so on a still
    // admin-less workspace this promotes the first person to land there -
    // no separate "Make me admin" click required. attemptBootstrap() still
    // enforces BOOTSTRAP_ADMIN_EMAIL (if set) and the TOCTOU-safe
    // single-winner logic, so a caller who doesn't match the configured
    // email, or who loses a concurrent race, simply doesn't get promoted.
    //
    // `justBootstrapped` tells the frontend this exact call is what did it,
    // so it can reload immediately instead of rendering "Admin access
    // required" from a stale client-side session.
    let justBootstrapped = false;
    if (!(await adminExists(c))) {
      const result = await attemptBootstrap(c, userId);
      justBootstrapped = result.status === 200;
    }
    return c.json({ adminExists: await adminExists(c), justBootstrapped });
  } catch (err) {
    return c.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to check admin status",
      },
      500,
    );
  }
});

router.post("/admin/bootstrap", async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const result = await attemptBootstrap(c, userId);
  return c.json(result.body, result.status as 200 | 400 | 403 | 409 | 500);
});

export default router;
