import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["**/src/**/*.test.ts"],
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/src/**/*.integration.test.ts",
            // has its own project below - needs jsdom, not plain node
            "artifacts/groundworkos/**",
          ],
        },
      },
      // artifacts/groundworkos/vitest.config.ts: jsdom + @testing-library/react,
      // for the one package in the workspace whose tests render components.
      "artifacts/groundworkos/vitest.config.ts",
    ],
  },
});
