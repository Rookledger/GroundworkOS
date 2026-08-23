import { describe, expect, it } from "vitest";
import { emailDomainAllowed, parseAllowedDomains } from "./signupPolicy";

describe("parseAllowedDomains", () => {
  it("returns an empty list for undefined or empty input", () => {
    expect(parseAllowedDomains(undefined)).toEqual([]);
    expect(parseAllowedDomains("")).toEqual([]);
  });

  it("splits, trims and lowercases comma-separated domains", () => {
    expect(parseAllowedDomains(" Example.com, foo.co.uk ,,bar.io")).toEqual([
      "example.com",
      "foo.co.uk",
      "bar.io",
    ]);
  });
});

describe("emailDomainAllowed", () => {
  it("allows anything when the allowlist is empty (check disabled)", () => {
    expect(emailDomainAllowed("anyone@anywhere.com", [])).toBe(true);
  });

  it("allows an email whose domain is on the allowlist", () => {
    expect(
      emailDomainAllowed("alice@example.com", ["example.com", "foo.io"]),
    ).toBe(true);
  });

  it("is case-insensitive on the domain", () => {
    expect(emailDomainAllowed("alice@Example.COM", ["example.com"])).toBe(true);
  });

  it("rejects an email whose domain is not on the allowlist", () => {
    expect(emailDomainAllowed("mallory@evil.com", ["example.com"])).toBe(false);
  });

  it("rejects a malformed email with no domain", () => {
    expect(emailDomainAllowed("not-an-email", ["example.com"])).toBe(false);
  });
});
