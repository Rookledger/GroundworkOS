/**
 * Registers the app-shell service worker (public/sw.js) so GroundworkOS can
 * be installed to a home screen and keeps working — for navigation only,
 * never for API data — when a site has no signal.
 *
 * Deliberately a no-op in dev: Vite's dev server already handles reloads,
 * and a cached dev bundle would fight with HMR.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => {
        console.warn("GroundworkOS: service worker registration failed", error);
      });
  });
}
