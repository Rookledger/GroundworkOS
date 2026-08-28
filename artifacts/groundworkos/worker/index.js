/**
 * Thin Worker script sitting in front of the static SPA assets.
 *
 * This project deploys as Cloudflare Workers static assets (see
 * wrangler.jsonc), and the SPA calls the API with relative paths
 * (`fetch("/api/...")`) expecting them to resolve same-origin. With no
 * custom domain/zone on this account, there's no Workers Route available to
 * split `/api/*` off to the separately-deployed `groundworkos-api` Worker
 * (Routes require a zone - see DEPLOYMENT.md Step 6). A service binding
 * does the same job without one: this script only runs for requests that
 * don't match a static asset file (Cloudflare serves matching assets
 * directly, without invoking this script at all), so it just needs to
 * decide, for the leftover requests, whether they're an API call to
 * forward or an SPA client-side route to fall back to the app shell for.
 *
 * The fallback used to construct a request for the literal "/index.html"
 * file and fetch that from the assets binding. That silently broke every
 * client-side route (e.g. /accept-invite, /setup, /portal/:token): Cloudflare's
 * default `html_handling` ("auto-trailing-slash") treats a request for
 * "/index.html" as a clean-URL candidate and 30x-redirects it to "/" before
 * ever returning content, and this Worker returned that redirect response
 * as-is. The browser then followed it, landing on "/" instead of the
 * originally-requested path - so wouter's Switch never even ran the router
 * against "/setup" or "/accept-invite"; it navigated to "/" first and only
 * then rendered. `not_found_handling: "single-page-application"` below is
 * Cloudflare's built-in equivalent for exactly this case: `env.ASSETS.fetch`
 * returns the app shell directly, with a real 200, for the original request
 * path - no redirect, no lost route. See DEPLOYMENT.md / wrangler.jsonc's
 * assets block for the flag.
 *
 * Deliberately plain JS, not TypeScript: this file lives outside
 * `src/` (which is what the frontend's tsconfig and Vite build cover) and
 * is bundled independently by `wrangler deploy`'s own esbuild step, which
 * doesn't type-check. Keeping it untyped avoids pulling in
 * `@cloudflare/workers-types` just for one small file.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return env.API.fetch(request);
    }

    // Pass the ORIGINAL request through unchanged - not a rewritten request
    // for "/index.html" (see comment above for why that redirected away from
    // the requested path). With `not_found_handling: "single-page-application"`
    // set, any path that isn't a literal static asset gets the app shell
    // back directly from this same call.
    return env.ASSETS.fetch(request);
  },
};
