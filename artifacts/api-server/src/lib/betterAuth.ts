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
 * `emailAndPassword.disableSignUp` keeps the public `/api/auth/sign-up/*`
 * HTTP endpoint switched off - GroundworkOS is invite-only end to end (see
 * routes/admin.ts's POST /invitations/accept), so the only way a Better Auth
 * user ever gets created is via `auth.api.signUpEmail(...)` called directly
 * from that trusted server-side route, never through the public API surface
 * this handler exposes.
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
      disableSignUp: true,
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
