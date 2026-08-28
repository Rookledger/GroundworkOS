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
 * forward or an SPA client-side route to fall back to index.html for -
 * replicating the `not_found_handling: "single-page-application"` behavior
 * this Worker replaces now that a script is present.
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

    const indexRequest = new Request(new URL("/index.html", url), request);
    return env.ASSETS.fetch(indexRequest);
  },
};
