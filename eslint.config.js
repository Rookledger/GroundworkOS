// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

const frontendPackages = ["artifacts/groundworkos", "artifacts/mockup-sandbox"];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.generated/**",
      "**/generated/**",
      "**/*.tsbuildinfo",
      "**/worker-configuration.d.ts",
      "pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TS's own unused-var checking is off (tsconfig.base.json sets
      // noUnusedLocals: false), so this is the only thing that catches
      // dead imports/locals - block CI on it rather than just warn.
      "@typescript-eslint/no-unused-vars": "error",
      // Baselined as a warning rather than off (tech-debt audit #6) so new
      // `any` usage is at least visible in CI output; the existing ~75
      // sites (mostly OAuth provider clients and integration test JSON
      // parsing) are being fixed incrementally rather than all at once.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  ...frontendPackages.map((pkg) => ({
    files: [`${pkg}/**/*.{ts,tsx}`],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.browser,
      },
    },
  })),
  ...frontendPackages.map((pkg) => ({
    files: [`${pkg}/**/*.{ts,tsx}`],
    ...react.configs.flat["jsx-runtime"],
  })),
  ...frontendPackages.map((pkg) => ({
    files: [`${pkg}/**/*.{ts,tsx}`],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
    settings: { react: { version: "19" } },
  })),
  {
    // The service worker (registerServiceWorker.ts's target) runs in its
    // own worker global scope, not a browser window - `self`/`caches`
    // aren't part of globals.browser above.
    files: ["artifacts/groundworkos/public/sw.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  ...frontendPackages.map((pkg) => ({
    files: [`${pkg}/**/*.{ts,tsx}`],
    rules: {
      // TypeScript already validates props at compile time; this rule
      // predates good TS support and false-positives on typed components
      // (e.g. render-prop components with generic prop types).
      "react/prop-types": "off",
      // Purely cosmetic (identical rendered output either way) and not
      // worth the churn of escaping every apostrophe in JSX text.
      "react/no-unescaped-entities": "off",
      // cmdk sets this as a real DOM attribute for CSS targeting.
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper"] },
      ],
    },
  })),
  prettierConfig,
);
