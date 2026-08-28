import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb, userTable, sessionTable, accountTable, verificationTable } from "@workspace/db";
import type { Bindings } from "../types";

/**
 * Builds a Better Auth instance scoped to one request.
 *
 * D1 bindings (`env.DB`) only exist for the lifetime of one request on
 * Workers - there is no module-level singleton the way a long-lived Node
 * process could have one (see `createDb()` in @workspace/db, which the same
 * constraint already applies to). So, unlike most Better Auth examples
 * which build a single module-level `auth` export, this constructs a fresh
 * instance per call, over a fresh `createDb(env.DB)` - cheap: it's just
 * wiring up config objects, no I/O happens until a route actually calls
 * into it.
 *
 * `emailAndPassword.disableSignUp` is deliberately left `false` here, even
 * though GroundworkOS is invite-only end to end. Better Auth enforces that
 * flag inside `signUpEmail` itself, which is the *same* handler function
 * whether it's reached through the public `/api/auth/sign-up/email` HTTP
 * route or called directly as `auth.api.signUpEmail(...)` - there's no
 * separate "internal" path that bypasses it. Setting `disableSignUp: true`
 * therefore didn't just close the public route, it also broke the two
 * trusted server-side callers that legitimately need signUpEmail:
 * routes/admin.ts's POST /invitations/accept and POST /setup/first-admin,
 * both of which started failing with "Email and password sign up is not
 * enabled". The public route is closed instead at the HTTP layer, in
 * app.ts, which blocks POST /api/auth/sign-up/email before it ever reaches
 * this handler while leaving `auth.api.signUpEmail(...)` itself usable.
 *
 * `user.additionalFields.role` with `input: false` means a client can never
 * set/override their own role through the public API (sign-up, update-user,
 * etc) - only a direct Drizzle UPDATE (see routes/admin.ts) ever changes it.
 */
export function createAuth(env: Bindings) {
  const db = createDb(env.DB);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: userTable,
        session: sessionTable,
        account: accountTable,
        verification: verificationTable,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    trustedOrigins: env.APP_URL ? [env.APP_URL] : [],
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "foreman",
          input: false,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
