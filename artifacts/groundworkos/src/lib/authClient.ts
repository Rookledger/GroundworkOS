import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

/**
 * Same convention every other API call in this app uses (see UsersPage.tsx,
 * App.tsx, DataLoader.tsx, etc): a relative `${basePath}/api/...` path,
 * not an absolute cross-origin URL. In production, `/api/*` is proxied to
 * the separately-deployed Worker via a Cloudflare Workers Route on the same
 * domain (see DEPLOYMENT.md Step 6), so this resolves same-origin and the
 * session cookie Better Auth sets is a first-party cookie - no cross-origin
 * credentialed-fetch dance needed. `credentials: "include"` is still set
 * below as a defensive default for any deployment where the frontend and
 * API genuinely are different origins (matching the API server's own
 * `cors({ credentials: true, origin: APP_URL })` in app.ts).
 */
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const authClient = createAuthClient({
  // Better Auth's client requires an absolute base URL - a bare relative
  // path like "/api/auth" throws `BetterAuthError: Invalid base URL` during
  // init and blanks the whole app before it can render. Resolving against
  // `window.location.origin` keeps this same-origin in every deployment
  // (see the class comment above) while satisfying that requirement.
  baseURL: `${window.location.origin}${basePath}/api/auth`,
  fetchOptions: {
    credentials: "include",
  },
  // Mirrors the server's `user.additionalFields.role` (see
  // lib/betterAuth.ts on the API server) so `useSession().data.user.role`
  // is typed here too - the two packages don't share types directly since
  // the API server is a separately deployed Worker.
  plugins: [inferAdditionalFields({ user: { role: { type: "string" } } })],
});

export const { useSession, signIn, signOut, getSession } = authClient;
