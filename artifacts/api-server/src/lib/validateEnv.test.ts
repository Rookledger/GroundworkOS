import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const { errorMock, warnMock } = vi.hoisted(() => ({
  errorMock: vi.fn(),
  warnMock: vi.fn(),
}));

// validateEnv.ts imports the real pino logger, which spins up a
// pino-pretty transport worker outside NODE_ENV=production. Mock it out so
// tests just observe which error messages would have been logged.
vi.mock("./logger", () => ({
  logger: { error: errorMock, warn: warnMock },
}));

const BASE_ENV = {
  PORT: "3000",
  DATABASE_URL: "postgres://localhost/test",
  APP_URL: "https://example.com",
  BASE_PATH: "/",
  STATIC_DIR: "artifacts/groundworkos/dist/public",
  S3_BUCKET: "bucket",
  S3_REGION: "us-east-1",
  S3_ENDPOINT: "https://s3.us-east-1.amazonaws.com",
  S3_ACCESS_KEY_ID: "id",
  S3_SECRET_ACCESS_KEY: "secret",
};

// pk_test_<base64("valid-app.clerk.accounts.dev$")>
const VALID_PUBLISHABLE_KEY =
  "pk_test_dmFsaWQtYXBwLmNsZXJrLmFjY291bnRzLmRldiQ=";
// pk_live_<base64("valid-app.clerk.accounts.dev$")>
const VALID_LIVE_PUBLISHABLE_KEY =
  "pk_live_dmFsaWQtYXBwLmNsZXJrLmFjY291bnRzLmRldiQ=";
const VALID_SECRET_KEY = "sk_test_abc123XYZ";

const originalEnv = { ...process.env };
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  errorMock.mockClear();
  warnMock.mockClear();
  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation(() => undefined as never);
});

afterEach(() => {
  process.env = { ...originalEnv };
  exitSpy.mockRestore();
});

async function loadValidateEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...originalEnv, ...BASE_ENV, ...overrides };
  return import("./validateEnv");
}

describe("validateEnv - CLERK_PUBLISHABLE_KEY", () => {
  it("accepts a valid pk_test_ key that decodes to a hostname ending in $", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("accepts a valid pk_live_ key", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_LIVE_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("rejects a key with the wrong prefix (e.g. a secret key pasted in by mistake)", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: "pk_x_dmFsaWQtYXBwLmNsZXJrLmFjY291bnRzLmRldiQ=",
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("CLERK_PUBLISHABLE_KEY"),
    );
  });

  it("rejects a body that isn't valid base64", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: "pk_test_not-valid-base64!!!",
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("CLERK_PUBLISHABLE_KEY"),
    );
  });

  it("rejects a decoded body missing the trailing $", async () => {
    // pk_test_<base64("valid-app.clerk.accounts.dev")>, no trailing $
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: "pk_test_dmFsaWQtYXBwLmNsZXJrLmFjY291bnRzLmRldg==",
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("CLERK_PUBLISHABLE_KEY"),
    );
  });

  it("rejects a decoded body that isn't a plausible hostname", async () => {
    // pk_test_<base64("not a hostname$")>
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: "pk_test_bm90IGEgaG9zdG5hbWUk",
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("CLERK_PUBLISHABLE_KEY"),
    );
  });
});

describe("validateEnv - CLERK_SECRET_KEY", () => {
  it("accepts a valid sk_test_ key", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: "sk_test_abc123XYZ",
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("accepts a valid sk_live_ key", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: "sk_live_abc123XYZ",
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("rejects a key with the wrong prefix", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: "pk_test_abc123XYZ",
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("CLERK_SECRET_KEY"),
    );
  });
});

describe("validateEnv - missing variables", () => {
  it("still fails when a required variable is absent", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      DATABASE_URL: undefined,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("DATABASE_URL"),
    );
  });

  it("fails once with the full list when several required variables are absent", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      APP_URL: undefined,
      S3_REGION: undefined,
      S3_ENDPOINT: undefined,
    });

    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith(expect.stringContaining("APP_URL"));
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("S3_REGION"),
    );
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("S3_ENDPOINT"),
    );
  });

  it.each(["APP_URL", "BASE_PATH", "STATIC_DIR"])(
    "fails when %s is absent",
    async (name) => {
      await loadValidateEnv({
        CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
        CLERK_SECRET_KEY: VALID_SECRET_KEY,
        [name]: undefined,
      });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorMock).toHaveBeenCalledWith(expect.stringContaining(name));
    },
  );

  it("explains that S3_REGION does not default to the provider's region when absent", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      S3_REGION: undefined,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("does NOT default to your provider's region"),
    );
  });

  it("explains that S3_ENDPOINT does not default to the provider's endpoint when absent", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      S3_ENDPOINT: undefined,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("does NOT default to your provider's endpoint"),
    );
  });
});

describe("validateEnv - SIGNUP_ALLOWED_EMAIL_DOMAINS / CLERK_WEBHOOK_SIGNING_SECRET", () => {
  it("fails when the allowlist is set without a webhook signing secret", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      SIGNUP_ALLOWED_EMAIL_DOMAINS: "example.com",
      CLERK_WEBHOOK_SIGNING_SECRET: undefined,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("SIGNUP_ALLOWED_EMAIL_DOMAINS"),
    );
  });

  it("passes when the allowlist is set alongside a webhook signing secret", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      SIGNUP_ALLOWED_EMAIL_DOMAINS: "example.com",
      CLERK_WEBHOOK_SIGNING_SECRET: "whsec_abc123",
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("passes when neither the allowlist nor the signing secret is set", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      SIGNUP_ALLOWED_EMAIL_DOMAINS: undefined,
      CLERK_WEBHOOK_SIGNING_SECRET: undefined,
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("passes when the allowlist is set to an empty/blank value without a signing secret", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      SIGNUP_ALLOWED_EMAIL_DOMAINS: " , ",
      CLERK_WEBHOOK_SIGNING_SECRET: undefined,
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe("validateEnv - CLERK_PUBLISHABLE_KEY / VITE_CLERK_PUBLISHABLE_KEY manifest consistency", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clerk-manifest-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeManifest(content: unknown) {
    fs.writeFileSync(
      path.join(tmpDir, "clerk-manifest.json"),
      typeof content === "string" ? content : JSON.stringify(content),
    );
  }

  it("passes and warns when no manifest file exists (e.g. local dev, API-only run)", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      STATIC_DIR: tmpDir,
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining("clerk-manifest.json"),
    );
  });

  it("passes silently when the manifest's publishable key matches CLERK_PUBLISHABLE_KEY", async () => {
    writeManifest({ publishableKey: VALID_PUBLISHABLE_KEY });

    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      STATIC_DIR: tmpDir,
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("fails loudly when the manifest's publishable key differs from CLERK_PUBLISHABLE_KEY (test vs live)", async () => {
    writeManifest({ publishableKey: VALID_LIVE_PUBLISHABLE_KEY });

    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      STATIC_DIR: tmpDir,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "CLERK_PUBLISHABLE_KEY does not match the VITE_CLERK_PUBLISHABLE_KEY",
      ),
    );
  });

  it("fails loudly when the manifest's publishable key differs from CLERK_PUBLISHABLE_KEY (different hosts)", async () => {
    // pk_test_<base64("other-app.clerk.accounts.dev$")>
    const DIFFERENT_HOST_KEY =
      "pk_test_b3RoZXItYXBwLmNsZXJrLmFjY291bnRzLmRldiQ=";
    writeManifest({ publishableKey: DIFFERENT_HOST_KEY });

    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      STATIC_DIR: tmpDir,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "CLERK_PUBLISHABLE_KEY does not match the VITE_CLERK_PUBLISHABLE_KEY",
      ),
    );
  });

  it("warns but does not fail when the manifest file is malformed JSON", async () => {
    writeManifest("not json{{{");

    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      STATIC_DIR: tmpDir,
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalled();
  });

  it("warns but does not fail when the manifest is missing the publishableKey field", async () => {
    writeManifest({ somethingElse: true });

    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      STATIC_DIR: tmpDir,
    });

    expect(errorMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalled();
  });

  it("skips the check entirely when STATIC_DIR itself is absent", async () => {
    await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
      STATIC_DIR: undefined,
    });

    // STATIC_DIR missing is still its own required-var failure, but the
    // manifest check itself must not also throw or add a second error.
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorMock).not.toHaveBeenCalledWith(
      expect.stringContaining("VITE_CLERK_PUBLISHABLE_KEY"),
    );
  });
});

describe("readClerkManifest / checkClerkPublishableKeysMatch (unit)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clerk-manifest-unit-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("readClerkManifest reports absent for a missing file", async () => {
    const mod = await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(mod.readClerkManifest(tmpDir)).toEqual({ status: "absent" });
  });

  it("readClerkManifest reports ok with the key for a well-formed manifest", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "clerk-manifest.json"),
      JSON.stringify({ publishableKey: VALID_PUBLISHABLE_KEY }),
    );

    const mod = await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(mod.readClerkManifest(tmpDir)).toEqual({
      status: "ok",
      publishableKey: VALID_PUBLISHABLE_KEY,
    });
  });

  it("readClerkManifest reports invalid for malformed JSON", async () => {
    fs.writeFileSync(path.join(tmpDir, "clerk-manifest.json"), "{not json");

    const mod = await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(mod.readClerkManifest(tmpDir)).toEqual({ status: "invalid" });
  });

  it("readClerkManifest reports invalid when publishableKey is missing or not a string", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "clerk-manifest.json"),
      JSON.stringify({ publishableKey: 123 }),
    );

    const mod = await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(mod.readClerkManifest(tmpDir)).toEqual({ status: "invalid" });
  });

  it("checkClerkPublishableKeysMatch returns null when staticDir is undefined", async () => {
    const mod = await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(
      mod.checkClerkPublishableKeysMatch(undefined, VALID_PUBLISHABLE_KEY),
    ).toBeNull();
  });

  it("checkClerkPublishableKeysMatch returns an error string on mismatch", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "clerk-manifest.json"),
      JSON.stringify({ publishableKey: VALID_LIVE_PUBLISHABLE_KEY }),
    );

    const mod = await loadValidateEnv({
      CLERK_PUBLISHABLE_KEY: VALID_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: VALID_SECRET_KEY,
    });

    expect(
      mod.checkClerkPublishableKeysMatch(tmpDir, VALID_PUBLISHABLE_KEY),
    ).toEqual(expect.stringContaining("does not match"));
  });
});
