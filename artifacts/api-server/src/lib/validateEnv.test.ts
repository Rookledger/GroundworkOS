import { describe, expect, it } from "vitest";
import { validateEnv } from "./validateEnv";
import type { Bindings } from "../types";

const VALID_SECRET = "a".repeat(32);

const BASE_ENV: Bindings = {
  DB: {} as D1Database,
  DOCS_BUCKET: {} as R2Bucket,
  KV: {} as KVNamespace,
  APP_URL: "https://example.com",
  BETTER_AUTH_SECRET: VALID_SECRET,
};

function env(overrides: Partial<Bindings>): Bindings {
  return { ...BASE_ENV, ...overrides };
}

describe("validateEnv - required variables", () => {
  it("passes with no errors when all required vars are present and valid", () => {
    expect(validateEnv(env({}))).toEqual([]);
  });

  it.each(["APP_URL", "BETTER_AUTH_SECRET"] as const)(
    "fails when %s is absent",
    (name) => {
      const errors = validateEnv(env({ [name]: undefined }));
      expect(errors).toEqual(
        expect.arrayContaining([expect.stringContaining(name)]),
      );
    },
  );

  it("reports every missing required variable in a single call", () => {
    const errors = validateEnv(
      env({ APP_URL: undefined, BETTER_AUTH_SECRET: undefined }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("APP_URL"),
        expect.stringContaining("BETTER_AUTH_SECRET"),
      ]),
    );
  });
});

describe("validateEnv - BETTER_AUTH_SECRET strength", () => {
  it("fails when the secret is set but too short", () => {
    const errors = validateEnv(env({ BETTER_AUTH_SECRET: "too-short" }));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Invalid BETTER_AUTH_SECRET"),
      ]),
    );
  });

  it("does not duplicate the missing-var error with the strength error when absent", () => {
    const errors = validateEnv(env({ BETTER_AUTH_SECRET: undefined }));
    expect(
      errors.filter((e) => e.includes("BETTER_AUTH_SECRET")),
    ).toHaveLength(1);
  });

  it("passes when the secret meets the minimum length", () => {
    expect(
      validateEnv(env({ BETTER_AUTH_SECRET: "b".repeat(32) })),
    ).toEqual([]);
  });

  it("fails when the secret is one character short of the minimum", () => {
    const errors = validateEnv(env({ BETTER_AUTH_SECRET: "c".repeat(31) }));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Invalid BETTER_AUTH_SECRET"),
      ]),
    );
  });
});
