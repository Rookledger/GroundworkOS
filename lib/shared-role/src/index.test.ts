import { describe, expect, it } from "vitest";
import { ROLE_RANK, isRole, resolveRole } from "./index";

describe("isRole", () => {
  it("accepts the three valid role strings", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("manager")).toBe(true);
    expect(isRole("foreman")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole("owner")).toBe(false);
    expect(isRole(42)).toBe(false);
  });
});

describe("resolveRole (no-role-defaults-to-foreman)", () => {
  it("passes through a recognized role unchanged", () => {
    expect(resolveRole("admin")).toBe("admin");
    expect(resolveRole("manager")).toBe("manager");
    expect(resolveRole("foreman")).toBe("foreman");
  });

  it("defaults to foreman when no role is set", () => {
    expect(resolveRole(undefined)).toBe("foreman");
    expect(resolveRole(null)).toBe("foreman");
  });

  it("defaults to foreman for any unrecognized value", () => {
    expect(resolveRole("owner")).toBe("foreman");
    expect(resolveRole(123)).toBe("foreman");
    expect(resolveRole({})).toBe("foreman");
  });
});

describe("ROLE_RANK", () => {
  it("orders admin above manager above foreman", () => {
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.manager);
    expect(ROLE_RANK.manager).toBeGreaterThan(ROLE_RANK.foreman);
  });
});
