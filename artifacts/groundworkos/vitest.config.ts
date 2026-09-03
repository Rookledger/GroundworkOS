import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Own project config (referenced from the root vitest.config.ts's
 * `test.projects`) rather than being folded into the root config's single
 * environment, because this is the one package in the workspace whose
 * tests need a DOM: `@testing-library/react` renders components into
 * jsdom, while every other package (lib/*, artifacts/api-server's unit
 * tests) is plain Node logic that doesn't need - and shouldn't pay the
 * cost of - a DOM environment.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    name: "groundworkos",
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
  },
});
