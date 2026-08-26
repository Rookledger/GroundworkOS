import { Hono } from "hono";
import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserRole, requireRole } from "./auth";
import type { AppEnv } from "../types";

vi.mock("@hono/clerk-auth", () => ({ getAuth: () => undefined }));

function makeClerk() {
  return { users: { getUser: vi.fn() } };
}
type FakeClerk = ReturnType<typeof makeClerk>;

/** Minimal fake Context carrying just what getUserRole reads/writes:
 * `userId`/`_role`/`clerk` via get/set. */
function makeContext(
  clerk: FakeClerk,
  vars: Record<string, unknown> = {},
): Context<AppEnv> {
  const store = new Map<string, unknown>(Object.entries(vars));
  store.set("clerk", clerk);
  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => store.set(key, value),
  } as unknown as Context<AppEnv>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserRole", () => {
  it("defaults to foreman when there is no authenticated user (no-role-defaults-to-foreman)", async () => {
    const clerk = makeClerk();
    await expect(getUserRole(makeContext(clerk))).resolves.toBe("foreman");
    expect(clerk.users.getUser).not.toHaveBeenCalled();
  });

  it("defaults to foreman when Clerk has no explicit role for the user", async () => {
    const clerk = makeClerk();
    clerk.users.getUser.mockResolvedValue({ publicMetadata: {} });
    await expect(
      getUserRole(makeContext(clerk, { userId: "user_1" })),
    ).resolves.toBe("foreman");
  });

  it("uses the explicit role stored in Clerk publicMetadata", async () => {
    const clerk = makeClerk();
    clerk.users.getUser.mockResolvedValue({
      publicMetadata: { role: "foreman" },
    });
    await expect(
      getUserRole(makeContext(clerk, { userId: "user_1" })),
    ).resolves.toBe("foreman");
  });

  it("uses a cached role on the request without calling Clerk again", async () => {
    const clerk = makeClerk();
    await expect(
      getUserRole(makeContext(clerk, { _role: "manager" })),
    ).resolves.toBe("manager");
    expect(clerk.users.getUser).not.toHaveBeenCalled();
  });

  it("does not swallow a Clerk lookup failure (fails closed, not open to admin)", async () => {
    const clerk = makeClerk();
    clerk.users.getUser.mockRejectedValue(new Error("Clerk outage"));
    await expect(
      getUserRole(makeContext(clerk, { userId: "user_1" })),
    ).rejects.toThrow("Clerk outage");
  });
});

describe("requireRole", () => {
  /** Mounts a bare GET / behind requireRole(minRole), with a fake Clerk
   * client and caller identity injected via middleware. */
  function buildApp(minRole: Parameters<typeof requireRole>[0], clerk: FakeClerk) {
    const app = new Hono<AppEnv>();
    app.use(async (c, next) => {
      c.set("userId", "user_1");
      c.set("clerk", clerk as never);
      await next();
    });
    app.get("/", requireRole(minRole), (c) => c.json({ ok: true }));
    return app;
  }

  it("calls next() when the caller's role meets the minimum", async () => {
    const clerk = makeClerk();
    clerk.users.getUser.mockResolvedValue({
      publicMetadata: { role: "manager" },
    });
    const app = buildApp("manager", clerk);

    const res = await app.request("/");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("rejects with 403 when the caller's role is below the minimum", async () => {
    const clerk = makeClerk();
    clerk.users.getUser.mockResolvedValue({
      publicMetadata: { role: "foreman" },
    });
    const app = buildApp("manager", clerk);

    const res = await app.request("/");

    expect(res.status).toBe(403);
  });

  it("rejects an admin-gated route for a user with no explicit role (no-role-defaults-to-foreman)", async () => {
    const clerk = makeClerk();
    clerk.users.getUser.mockResolvedValue({ publicMetadata: {} });
    const app = buildApp("admin", clerk);

    const res = await app.request("/");

    expect(res.status).toBe(403);
  });

  it("fails closed with 503 (not a silent admin fallback) when the role can't be verified", async () => {
    const clerk = makeClerk();
    clerk.users.getUser.mockRejectedValue(new Error("Clerk outage"));
    const app = buildApp("foreman", clerk);

    const res = await app.request("/");

    expect(res.status).toBe(503);
  });
});
