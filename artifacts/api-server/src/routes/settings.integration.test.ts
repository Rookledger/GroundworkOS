import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import settingsRouter from "./settings";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Clerk is stubbed here rather than in
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched; only this test's identity/role for `c.get("clerk")` and
 * `c.get("userId")` differs.
 *
 * Unlike most other integration tests, this file also drives
 * clerk.users.getUserList: PUT /settings/company's bootstrap gating
 * (routes/settings.ts) calls adminExists() (routes/admin.ts), which calls
 * getUserList, so exercising that gating logic - not just a default admin
 * role - is the whole point of this file. Defaults to "an admin exists",
 * matching a normal, already-onboarded deployment.
 */
function buildApp() {
  const clerk = {
    users: {
      getUser: vi
        .fn()
        .mockResolvedValue({ publicMetadata: { role: "admin" } }),
      getUserList: vi
        .fn()
        .mockResolvedValue({
          data: [{ publicMetadata: { role: "admin" } }],
          totalCount: 1,
        }),
    },
  };
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", createDb(env.DB));
    c.set("clerk", clerk as never);
    c.set("userId", "integration-test-user");
    c.set(
      "logger",
      { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } as never,
    );
    c.set("clerkAuth", (() => undefined) as never);
    await next();
  });
  app.route("/", settingsRouter);
  return { app, clerk };
}

const db = createDb(env.DB);

describe("PUT /settings/company bootstrap gating", () => {
  it("rejects a foreman once an admin already exists", async () => {
    const { app, clerk } = buildApp();
    clerk.users.getUserList.mockResolvedValueOnce({
      data: [{ publicMetadata: { role: "admin" } }],
      totalCount: 1,
    } as any);
    clerk.users.getUser.mockResolvedValueOnce({
      publicMetadata: { role: "foreman" },
    } as any);

    const res = await app.request("/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Should Not Save Ltd" }),
    });
    expect(res.status).toBe(403);
  });

  it("allows a foreman through while no admin exists yet, mirroring the admin bootstrap flow", async () => {
    const { app, clerk } = buildApp();
    // adminExists() === false makes the route call next() and skip
    // requireRole entirely, so no getUser override is queued here - one
    // would sit unconsumed and leak into a later request.
    clerk.users.getUserList.mockResolvedValueOnce({
      data: [],
      totalCount: 0,
    } as any);

    const res = await app.request("/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Bootstrap Onboarding Ltd" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const [persisted] = await db
      .select()
      .from(companySettingsTable)
      .where(eq(companySettingsTable.id, 1));
    expect((persisted?.data as any)?.companyName).toBe(
      "Bootstrap Onboarding Ltd",
    );
  });
});

describe("full write cycle for PUT /settings/company", () => {
  it("persists company settings and reflects them on GET, replacing rather than merging on a second PUT", async () => {
    const { app } = buildApp();

    const firstPut = await app.request("/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "GroundworkOS Ltd",
        vatNumber: "GB 123 4567 89",
      }),
    });
    expect(firstPut.status).toBe(200);

    const getAfterFirst = await app.request("/settings/company");
    expect(getAfterFirst.status).toBe(200);
    const afterFirst = await getAfterFirst.json();
    expect(afterFirst.companyName).toBe("GroundworkOS Ltd");
    expect(afterFirst.vatNumber).toBe("GB 123 4567 89");

    // The route stores the parsed body verbatim as the new `data` value
    // (INSERT ... ON CONFLICT DO UPDATE SET data = <new body>) - it does not
    // merge with the previous value. A second PUT that omits vatNumber must
    // therefore drop it, not silently preserve the old value.
    const secondPut = await app.request("/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "GroundworkOS Holdings Ltd" }),
    });
    expect(secondPut.status).toBe(200);

    const getAfterSecond = await app.request("/settings/company");
    const afterSecond = await getAfterSecond.json();
    expect(afterSecond.companyName).toBe("GroundworkOS Holdings Ltd");
    expect(afterSecond.vatNumber).toBeUndefined();

    const [persisted] = await db
      .select()
      .from(companySettingsTable)
      .where(eq(companySettingsTable.id, 1));
    expect((persisted?.data as any)?.companyName).toBe(
      "GroundworkOS Holdings Ltd",
    );
    expect((persisted?.data as any)?.vatNumber).toBeUndefined();
  });
});
