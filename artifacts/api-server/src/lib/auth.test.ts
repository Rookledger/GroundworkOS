import { Hono } from "hono";
import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import { getUserRole, requireRole } from "./auth";
import type { AppEnv } from "../types";

/** Minimal fake Context carrying just what getUserRole reads: `_role` via
 * get/set. */
function makeContext(vars: Record<string, unknown> = {}): Context<AppEnv> {
  const store = new Map<string, unknown>(Object.entries(vars));
  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => store.set(key, value),
  } as unknown as Context<AppEnv>;
}

describe("getUserRole", () => {
  it("defaults to foreman when there is no session (no-role-defaults-to-foreman)", () => {
    expect(getUserRole(makeContext())).toBe("foreman");
  });

  it("reads the role the session middleware already cached on the context", () => {
    expect(getUserRole(makeContext({ _role: "manager" }))).toBe("manager");
  });

  it("defaults to foreman even when userId is set but _role never got cached", () => {
    // Shouldn't happen in practice (app.ts's session middleware always sets
    // both together), but getUserRole must not assume otherwise.
    expect(getUserRole(makeContext({ userId: "user_1" }))).toBe("foreman");
  });
});

describe("requireRole", () => {
  /** Mounts a bare GET / behind requireRole(minRole), with the caller's role
   * injected via middleware exactly as app.ts's session middleware would. */
  function buildApp(
    minRole: Parameters<typeof requireRole>[0],
    role: "admin" | "manager" | "foreman" | undefined,
  ) {
    const app = new Hono<AppEnv>();
    app.use(async (c, next) => {
      c.set("userId", "user_1");
      if (role) c.set("_role", role);
      await next();
    });
    app.get("/", requireRole(minRole), (c) => c.json({ ok: true }));
    return app;
  }

  it("calls next() when the caller's role meets the minimum", async () => {
    const app = buildApp("manager", "manager");

    const res = await app.request("/");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("rejects with 403 when the caller's role is below the minimum", async () => {
    const app = buildApp("manager", "foreman");

    const res = await app.request("/");

    expect(res.status).toBe(403);
  });

  it("rejects an admin-gated route for a user with no explicit role (no-role-defaults-to-foreman)", async () => {
    const app = buildApp("admin", undefined);

    const res = await app.request("/");

    expect(res.status).toBe(403);
  });

  it("allows an admin-gated route for an explicit admin", async () => {
    const app = buildApp("admin", "admin");

    const res = await app.request("/");

    expect(res.status).toBe(200);
  });
});
