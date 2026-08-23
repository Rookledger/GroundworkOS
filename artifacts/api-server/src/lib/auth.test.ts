import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuth, clerkClient } = vi.hoisted(() => ({
  getAuth: vi.fn(),
  clerkClient: { users: { getUser: vi.fn() } },
}));

vi.mock("@clerk/express", () => ({ getAuth, clerkClient }));

const { getUserRole, requireRole } = await import("./auth");

function makeReq(overrides: Record<string, any> = {}) {
  return { ...overrides } as any;
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuth.mockReturnValue({ userId: undefined });
});

describe("getUserRole", () => {
  it("defaults to foreman when there is no authenticated user (no-role-defaults-to-foreman)", async () => {
    await expect(getUserRole(makeReq())).resolves.toBe("foreman");
    expect(clerkClient.users.getUser).not.toHaveBeenCalled();
  });

  it("defaults to foreman when Clerk has no explicit role for the user", async () => {
    getAuth.mockReturnValue({ userId: "user_1" });
    clerkClient.users.getUser.mockResolvedValue({ publicMetadata: {} });
    await expect(getUserRole(makeReq())).resolves.toBe("foreman");
  });

  it("uses the explicit role stored in Clerk publicMetadata", async () => {
    getAuth.mockReturnValue({ userId: "user_1" });
    clerkClient.users.getUser.mockResolvedValue({
      publicMetadata: { role: "foreman" },
    });
    await expect(getUserRole(makeReq())).resolves.toBe("foreman");
  });

  it("uses a cached role on the request without calling Clerk again", async () => {
    await expect(getUserRole(makeReq({ _role: "manager" }))).resolves.toBe(
      "manager",
    );
    expect(clerkClient.users.getUser).not.toHaveBeenCalled();
  });

  it("does not swallow a Clerk lookup failure (fails closed, not open to admin)", async () => {
    getAuth.mockReturnValue({ userId: "user_1" });
    clerkClient.users.getUser.mockRejectedValue(new Error("Clerk outage"));
    await expect(getUserRole(makeReq())).rejects.toThrow("Clerk outage");
  });
});

describe("requireRole", () => {
  it("calls next() when the caller's role meets the minimum", async () => {
    getAuth.mockReturnValue({ userId: "user_1" });
    clerkClient.users.getUser.mockResolvedValue({
      publicMetadata: { role: "manager" },
    });
    const res = makeRes();
    const next = vi.fn();
    await requireRole("manager")(makeReq(), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the caller's role is below the minimum", async () => {
    getAuth.mockReturnValue({ userId: "user_1" });
    clerkClient.users.getUser.mockResolvedValue({
      publicMetadata: { role: "foreman" },
    });
    const res = makeRes();
    const next = vi.fn();
    await requireRole("manager")(makeReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects an admin-gated route for a user with no explicit role (no-role-defaults-to-foreman)", async () => {
    getAuth.mockReturnValue({ userId: "user_1" });
    clerkClient.users.getUser.mockResolvedValue({ publicMetadata: {} });
    const res = makeRes();
    const next = vi.fn();
    await requireRole("admin")(makeReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("fails closed with 503 (not a silent admin fallback) when the role can't be verified", async () => {
    getAuth.mockReturnValue({ userId: "user_1" });
    clerkClient.users.getUser.mockRejectedValue(new Error("Clerk outage"));
    const res = makeRes();
    const next = vi.fn();
    await requireRole("foreman")(makeReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
