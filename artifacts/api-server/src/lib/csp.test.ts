import { describe, expect, it } from "vitest";
import {
  buildCspDirectives,
  clerkFrontendApiOrigin,
  decodeClerkFrontendApiHost,
} from "./csp";

// pk_test_<base64("test-app-12ab34cd.clerk.accounts.dev$")>
const SAMPLE_TEST_KEY =
  "pk_test_dGVzdC1hcHAtMTJhYjM0Y2QuY2xlcmsuYWNjb3VudHMuZGV2JA==";
const SAMPLE_TEST_HOST = "test-app-12ab34cd.clerk.accounts.dev";
const SAMPLE_TEST_ORIGIN = `https://${SAMPLE_TEST_HOST}`;

// pk_live_<base64("clerk.example.com$")>
const SAMPLE_LIVE_KEY = "pk_live_Y2xlcmsuZXhhbXBsZS5jb20k";
const SAMPLE_LIVE_ORIGIN = "https://clerk.example.com";

describe("decodeClerkFrontendApiHost", () => {
  it("decodes the frontend API host from a test publishable key", () => {
    expect(decodeClerkFrontendApiHost(SAMPLE_TEST_KEY)).toBe(SAMPLE_TEST_HOST);
  });

  it("decodes the frontend API host from a live publishable key", () => {
    expect(decodeClerkFrontendApiHost(SAMPLE_LIVE_KEY)).toBe(
      "clerk.example.com",
    );
  });

  it("returns null when no key is configured", () => {
    expect(decodeClerkFrontendApiHost(undefined)).toBeNull();
  });

  it("returns null for a malformed key", () => {
    expect(decodeClerkFrontendApiHost("not-a-clerk-key")).toBeNull();
  });

  it("returns null when the decoded payload has no trailing $", () => {
    const badKey = `pk_test_${Buffer.from("no-dollar-suffix.example.com").toString("base64")}`;
    expect(decodeClerkFrontendApiHost(badKey)).toBeNull();
  });
});

describe("clerkFrontendApiOrigin", () => {
  it("returns an https origin for a valid key", () => {
    expect(clerkFrontendApiOrigin(SAMPLE_TEST_KEY)).toBe(SAMPLE_TEST_ORIGIN);
  });

  it("returns null when no key is configured", () => {
    expect(clerkFrontendApiOrigin(undefined)).toBeNull();
  });
});

describe("buildCspDirectives", () => {
  it("includes the Clerk Frontend API origin in every directive Clerk needs", () => {
    const directives = buildCspDirectives(SAMPLE_TEST_KEY);

    expect(directives["script-src"]).toContain(SAMPLE_TEST_ORIGIN);
    expect(directives["connect-src"]).toContain(SAMPLE_TEST_ORIGIN);
    expect(directives["img-src"]).toContain(SAMPLE_TEST_ORIGIN);
    expect(directives["worker-src"]).toContain(SAMPLE_TEST_ORIGIN);
    expect(directives["frame-src"]).toContain(SAMPLE_TEST_ORIGIN);
  });

  it("derives the origin from whatever key is passed in, not a hardcoded domain", () => {
    const directives = buildCspDirectives(SAMPLE_LIVE_KEY);

    expect(directives["script-src"]).toContain(SAMPLE_LIVE_ORIGIN);
    expect(directives["connect-src"]).toContain(SAMPLE_LIVE_ORIGIN);
  });

  it("still allows self, blob:, and data: where Clerk needs them", () => {
    const directives = buildCspDirectives(SAMPLE_TEST_KEY);

    expect(directives["img-src"]).toEqual(
      expect.arrayContaining(["'self'", "data:", "blob:"]),
    );
    expect(directives["worker-src"]).toEqual(
      expect.arrayContaining(["'self'", "blob:", "data:"]),
    );
  });

  it("keeps the CSP locked down when no publishable key is configured", () => {
    const directives = buildCspDirectives(undefined);

    expect(directives["script-src"]).toEqual(["'self'"]);
    expect(directives["connect-src"]).toEqual(["'self'"]);
    expect(directives["frame-ancestors"]).toEqual(["'none'"]);
    expect(directives["object-src"]).toEqual(["'none'"]);
  });
});
