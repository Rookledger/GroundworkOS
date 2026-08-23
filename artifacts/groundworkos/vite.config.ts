import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

/**
 * The frontend and the API server each read their own copy of the Clerk
 * publishable key from a different env var (VITE_CLERK_PUBLISHABLE_KEY here,
 * at build time; CLERK_PUBLISHABLE_KEY in the API server, at runtime — see
 * artifacts/api-server/src/lib/csp.ts). Nothing enforces that the two stay
 * in sync: if an operator sets a pk_test in one and a pk_live in the other,
 * the API server's CSP ends up allow-listing a different Clerk Frontend API
 * origin than the one baked into this bundle, so the browser blocks the
 * exact Clerk script the app needs and the page renders blank with nothing
 * logged server-side.
 *
 * To let the API server catch that mismatch loudly at boot (see
 * validateEnv.ts), record the key this build actually inlined in a small
 * manifest file alongside the built assets. It's not a secret — publishable
 * keys are meant to be public — so writing it to a static, deployed file is
 * safe.
 */
function clerkManifestPlugin(publishableKey: string): Plugin {
  return {
    name: "clerk-manifest",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(import.meta.dirname, "dist/public");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, "clerk-manifest.json"),
        JSON.stringify({ publishableKey }, null, 2) + "\n",
      );
    },
  };
}

export default defineConfig(({ command, isPreview }) => {
  if (command === "build" && !process.env.VITE_CLERK_PUBLISHABLE_KEY) {
    throw new Error(
      "VITE_CLERK_PUBLISHABLE_KEY is required to build the frontend but was not provided. " +
        "Vite inlines this value at build time, so a build without it produces a bundle that " +
        "throws at startup and renders a blank page. Set VITE_CLERK_PUBLISHABLE_KEY in Railway's " +
        "service variables before deploying.",
    );
  }

  const needsPort = command === "serve" || isPreview;

  let port: number | undefined;

  if (needsPort) {
    const rawPort = process.env.PORT;

    if (!rawPort) {
      throw new Error(
        "PORT environment variable is required but was not provided.",
      );
    }

    port = Number(rawPort);

    if (Number.isNaN(port) || port <= 0) {
      throw new Error(`Invalid PORT value: "${rawPort}"`);
    }
  }

  let basePath = process.env.BASE_PATH;

  if (!basePath) {
    console.warn(
      'BASE_PATH environment variable was not provided; defaulting to "/".',
    );
    basePath = "/";
  }

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss({ optimize: false }),
      ...(command === "build"
        ? [clerkManifestPlugin(process.env.VITE_CLERK_PUBLISHABLE_KEY!)]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (/[\\/]node_modules[\\/]react(-dom)?[\\/]/.test(id))
              return "react";
            if (id.includes("@react-pdf/renderer")) return "react-pdf";
            if (id.includes("recharts")) return "recharts";
            if (id.includes("@radix-ui/")) return "radix";
          },
        },
      },
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
