import { describe, expect, it } from "vitest";
import { validateEnv, isValidPublishableKey, isValidSecretKey } from "./validateEnv";
import type { Bindings } from "../types";

// pk_test_<base64("valid-app.clerk.accounts.dev$")>
const VALID_PUBLISHABLE_KEY =
  "pk_test_dmFsaWQtYXBwLmNsZXJrLmFjY291bnRzLmRldiQ=";
// pk_live_<base64("valid-app.clerk.accounts.dev$")>
const VALID_LIVE_PUBLISHABLE_KEY =
  "pk_live_dmFsaWQtYXBwLmNsZXJrLmFjY291bnRzLmRldiQ=";
// pk_test_<base64("valid-app.clerk.accounts.dev$")>, unpadded - the shape
// Clerk's own Dashboard actually issues (see BASE64_RE in validateEnv.ts).
// Same decoded value as VALID_PUBLISHABLE_KEY above, just without the
// trailing "=".
const VALID_UNPADDED_PUBLISHABLE_KEY =
  "pk_test_dmFsaWQtYXBwLmNsZXJrLmFjY291bnRzLmRldiQ";
const VALID_SECRET_KEY = "sk_test_abc123XYZ";

const BASE_ENV: Bindings = {
  DB: {} as D1Database,
  DOCS_BUCKET: {} as R2Bucket,
  KV: {} as KVNamespace,
  APP_URL: "https://example.com",
  CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: VALID_SECRET_KEY,
};

function env(overrides: Partial<Bindings>): Bindings {
  return { ...BASE_ENV, ...overrides };
}

describe("isValidPublishableKey / isValidSecretKey", () => {
  it("accepts a valid pk_test_ key that decodes to a hostname ending in $", () => {
    expect(isValidPublishableKey(VALID_PUBLISHABLE_KEY)).toBe(true);
  });

  it("accepts a valid pk_live_ key", () => {
    expect(isValidPublishableKey(VALID_LIVE_PUBLISHABLE_KEY)).toBe(true);
  });

  it("accepts a valid unpadded key, matching the shape Clerk's Dashboard actually issues", () => {
    expect(isValidPublishableKey(VALID_UNPADDED_PUBLISHABLE_KEY)).toBe(true);
  });

  it("rejects a key with the wrong prefix (e.g. a secret key pasted in by mistake)", () => {
    expect(
      isValidPublishableKey("pk_x_dmFsaWQtYXBwLmNsZXJrLmFjY291bnRzLmRldiQ="),
    ).toBe(false);
  });

  it("rejects a body that isn't valid base64", () => {
    expect(isValidPublishableKey("pk_test_not-valid-base64!!!")).toBe(false);
  });

  it("rejects a body whose length is impossible for base64 (remainder of 1)", () => {
    // 13 full groups of 4 plus a single leftover character - no valid
    // padded or unpadded base64 encoding has a body shaped like this.
    expect(isValidPublishableKey(`pk_test_${"A".repeat(52)}B`)).toBe(false);
  });

  it("rejects a decoded body missing the trailing $", () => {
    // pk_test_<base64("valid-app.clerk.accounts.dev")>, no trailing $
    expect(
      isValidPublishableKey("pk_test_dmFsaWQtYXBwLmNsZXJrLmFjY291bnRzLmRldg=="),
    ).toBe(false);
  });

  it("rejects a decoded body that isn't a plausible hostname", () => {
    // pk_test_<base64("not a hostname$")>
    expect(isValidPublishableKey("pk_test_bm90IGEgaG9zdG5hbWUk")).toBe(false);
  });

  it("accepts a valid sk_test_ key", () => {
    expect(isValidSecretKey("sk_test_abc123XYZ")).toBe(true);
  });

  it("accepts a valid sk_live_ key", () => {
    expect(isValidSecretKey("sk_live_abc123XYZ")).toBe(true);
  });

  it("rejects a key with the wrong prefix", () => {
    expect(isValidSecretKey("pk_test_abc123XYZ")).toBe(false);
  });
});

describe("validateEnv - required variables", () => {
  it("passes with no errors when all required vars are present and valid", () => {
    expect(validateEnv(env({}))).toEqual([]);
  });

  it.each(["APP_URL", "CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"] as const)(
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
      env({ APP_URL: undefined, CLERK_SECRET_KEY: undefined }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("APP_URL"),
        expect.stringContaining("CLERK_SECRET_KEY"),
      ]),
    );
  });
});

describe("validateEnv - CLERK_PUBLISHABLE_KEY shape", () => {
  it("fails when CLERK_PUBLISHABLE_KEY is set but malformed", () => {
    const errors = validateEnv(
      env({ CLERK_PUBLISHABLE_KEY: "not-a-real-key" }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Invalid CLERK_PUBLISHABLE_KEY"),
      ]),
    );
  });

  it("does not duplicate the missing-var error with the shape error when absent", () => {
    const errors = validateEnv(env({ CLERK_PUBLISHABLE_KEY: undefined }));
    expect(
      errors.filter((e) => e.includes("CLERK_PUBLISHABLE_KEY")),
    ).toHaveLength(1);
  });
});

describe("validateEnv - CLERK_SECRET_KEY shape", () => {
  it("fails when CLERK_SECRET_KEY is set but malformed", () => {
    const errors = validateEnv(
      env({ CLERK_SECRET_KEY: "pk_test_abc123XYZ" }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Invalid CLERK_SECRET_KEY"),
      ]),
    );
  });
});

describe("validateEnv - CLERK_WEBHOOK_SIGNING_SECRET", () => {
  it("passes when unset", () => {
    expect(validateEnv(env({ CLERK_WEBHOOK_SIGNING_SECRET: undefined }))).toEqual(
      [],
    );
  });

  it("passes when it has the whsec_ prefix", () => {
    expect(
      validateEnv(env({ CLERK_WEBHOOK_SIGNING_SECRET: "whsec_abc123" })),
    ).toEqual([]);
  });

  it("fails when set without the whsec_ prefix", () => {
    const errors = validateEnv(
      env({ CLERK_WEBHOOK_SIGNING_SECRET: "abc123" }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Invalid CLERK_WEBHOOK_SIGNING_SECRET"),
      ]),
    );
  });
});

describe("validateEnv - SIGNUP_ALLOWED_EMAIL_DOMAINS / CLERK_WEBHOOK_SIGNING_SECRET", () => {
  it("fails when the allowlist is set without a webhook signing secret", () => {
    const errors = validateEnv(
      env({
        SIGNUP_ALLOWED_EMAIL_DOMAINS: "example.com",
        CLERK_WEBHOOK_SIGNING_SECRET: undefined,
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("SIGNUP_ALLOWED_EMAIL_DOMAINS"),
      ]),
    );
  });

  it("passes when the allowlist is set alongside a webhook signing secret", () => {
    expect(
      validateEnv(
        env({
          SIGNUP_ALLOWED_EMAIL_DOMAINS: "example.com",
          CLERK_WEBHOOK_SIGNING_SECRET: "whsec_abc123",
        }),
      ),
    ).toEqual([]);
  });

  it("passes when neither the allowlist nor the signing secret is set", () => {
    expect(
      validateEnv(
        env({
          SIGNUP_ALLOWED_EMAIL_DOMAINS: undefined,
          CLERK_WEBHOOK_SIGNING_SECRET: undefined,
        }),
      ),
    ).toEqual([]);
  });

  it("passes when the allowlist is set to an empty/blank value without a signing secret", () => {
    expect(
      validateEnv(
        env({
          SIGNUP_ALLOWED_EMAIL_DOMAINS: " , ",
          CLERK_WEBHOOK_SIGNING_SECRET: undefined,
        }),
      ),
    ).toEqual([]);
  });
});
