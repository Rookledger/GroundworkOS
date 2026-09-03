import { env } from "cloudflare:test";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDb, companySettingsTable, userTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import settingsRouter from "./settings";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched.
 *
 * Unlike most other integration tests, this file also drives the `user`
 * table directly: PUT /settings/company's bootstrap gating (routes/
 * settings.ts) calls adminExists() (routes/admin.ts), which is now a real
 * D1 query against that table - so exercising that gating logic means
 * seeding (or not seeding) an admin row, not just setting the caller's own
 * cached role.
 */
function buildApp(role: "admin" | "manager" | "foreman" = "admin") {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", createDb(env.DB));
    c.set("userId", "integration-test-user");
    c.set("_role", role);
    c.set("logger", {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as never);
    await next();
  });
  app.route("/", settingsRouter);
  return app;
}

const db = createDb(env.DB);

function makeUser(overrides: Partial<typeof userTable.$inferInsert> = {}) {
  const now = new Date();
  return {
    id: "settings-test-admin",
    name: "Existing Admin",
    email: "existing-admin@example.com",
    emailVerified: false,
    role: "admin",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// adminExists() (routes/admin.ts) queries the `user` table directly, so
// each test controls it by inserting (or not inserting) an admin row here -
// cleaned up after every test so state never leaks between them.
afterEach(async () => {
  await db.delete(userTable);
});

describe("PUT /settings/company bootstrap gating", () => {
  it("rejects a foreman once an admin already exists", async () => {
    await db.insert(userTable).values(makeUser());
    const app = buildApp("foreman");

    const res = await app.request("/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Should Not Save Ltd" }),
    });
    expect(res.status).toBe(403);
  });

  it("allows a foreman through while no admin exists yet, mirroring the admin bootstrap flow", async () => {
    // No admin row inserted - adminExists() === false makes the route call
    // next() and skip requireRole entirely.
    const app = buildApp("foreman");

    const res = await app.request("/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Bootstrap Onboarding Ltd" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
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
    const app = buildApp("admin");

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
    const afterFirst = (await getAfterFirst.json()) as any;
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
    const afterSecond = (await getAfterSecond.json()) as any;
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
