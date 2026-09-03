# 3. Better Auth, replacing Clerk

**Status:** Accepted, implemented

## Context

Authentication previously ran through Clerk, a hosted/external provider.
Clerk's browser SDK loaded from a per-instance "Clerk Frontend API" origin
decoded out of `CLERK_PUBLISHABLE_KEY`, which meant that origin had to be
allow-listed across the Content-Security-Policy's `script-src`,
`connect-src`, `img-src`, `worker-src` and `frame-src` directives (see the
comment in `artifacts/api-server/src/lib/csp.ts`). The backend used
`clerkMiddleware()` for session resolution and read `sessionClaims` for a
denormalized display name/email. Roles were stored in Clerk's
`publicMetadata.role`. The frontend needed its own separate publishable
key, kept in sync with the backend's. There was a hosted account-portal
modal for profile/password management, and a cache invalidator watching
Clerk's own auth-state listener to clear the React Query cache on
sign-in/out.

## Decision

Move to [Better Auth](https://www.better-auth.com), running same-origin on
the Worker itself, mounted at `/api/auth/*`. It's built per-request
(`createAuth(env)` in `artifacts/api-server/src/lib/betterAuth.ts`), not a
module-level singleton, for the same reason the D1 connection is
per-request (ADR 0001/0002). Session middleware in `app.ts` reads the
session cookie directly via Better Auth's server API and sets
`userId`/`_role` on the request context. Roles now live in D1's `user`
table (`role` column), extending Better Auth's user schema with
`input: false` so a client can't self-elevate by passing a `role` field on
signup. `AccountModal.tsx` is a minimal in-app replacement for Clerk's
hosted modal, covering password change. Sign-in is email + password only,
invite-only end to end — there is no public sign-up route.

## Reasons

- Same-origin auth eliminates the CSP allow-list problem entirely:
  everything Better Auth needs is already covered by `'self'`, since it's
  mounted on the same Worker rather than calling out to an external
  Frontend API (`csp.ts`).
- No separate publishable key to keep in sync between the frontend build
  and the backend.
- Session/role lookup is a plain cached read off the request context
  rather than a call that can fail independently of the session check
  itself (`artifacts/api-server/src/lib/auth.ts`).

## Consequences

**Positive** — see Reasons above; also removed an entire category of CSP
configuration and a second secret (the publishable key) to provision per
deployment.

**Negative / tradeoffs**

- The obvious way to enforce "invite-only, no public sign-up" —
  `emailAndPassword.disableSignUp: true` — turned out to disable
  `signUpEmail` everywhere, including trusted server-side callers like
  `POST /invitations/accept` and the first-admin bootstrap flow, breaking
  them with "Email and password sign up is not enabled." The fix instead
  blocks the public HTTP route directly in `app.ts` and leaves the
  Better Auth flag `false` — see the comment in `betterAuth.ts`.
- The first-admin bootstrap flow itself has a known privilege-escalation
  race: on a workspace with zero admins, whoever opens **Settings → Users**
  first is auto-promoted via a side-effecting `GET`, mitigated only by an
  optional `BOOTSTRAP_ADMIN_EMAIL`. This isn't a regression caused by the
  migration, but it is part of the new auth/bootstrap design and is
  tracked as tech-debt finding #2 (`TECH_DEBT_AUDIT.md`).

## Citations

`README.md` ("unlike the project's earlier Clerk setup, the frontend needs
no separate publishable key"; role table; bootstrap flow description);
`artifacts/api-server/src/app.ts` (session middleware, invite-only route
guard); `artifacts/api-server/src/lib/betterAuth.ts` (`createAuth`,
`disableSignUp` comment); `artifacts/api-server/src/lib/auth.ts`
(`getUserRole`, no external call); `artifacts/api-server/src/lib/csp.ts`
(CSP rationale); `artifacts/api-server/src/routes/admin.ts` (bootstrap
flow); `lib/shared-role/src/index.ts` (role storage migrated off Clerk
`publicMetadata`); `artifacts/groundworkos/src/components/layout/AccountModal.tsx`
(hosted-modal replacement); `artifacts/groundworkos/src/App.tsx`
(cache-invalidator replacement).
