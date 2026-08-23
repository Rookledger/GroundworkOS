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
      "pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The codebase relies on TS's own unused-var checking being off
      // (tsconfig.base.json sets noUnusedLocals: false); keep ESLint's
      // check but only flag it, don't block on it.
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "off",
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
