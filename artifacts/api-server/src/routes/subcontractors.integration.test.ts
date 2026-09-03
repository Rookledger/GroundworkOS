import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, subcontractorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import subcontractorsRouter from "./subcontractors";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched. subcontractorsRouter is mounted directly
 * (rather than the full app.ts) so no real Clerk network calls or
 * CORS/rate-limit middleware are involved.
 */
function buildApp() {
  // Mutable so a test can change the caller's role between requests
  // (mirroring the old per-call Clerk mock override), without needing a new
  // app/middleware per request.
  const state = { role: "admin" as import("@workspace/shared-role").Role };
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", createDb(env.DB));
    c.set("userId", "integration-test-user");
    c.set("_role", state.role);
    c.set("logger", {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as never);
    await next();
  });
  app.route("/", subcontractorsRouter);
  return { app, state };
}

const db = createDb(env.DB);

describe("full write cycle for /subcontractors/:id", () => {
  it("creates, reads, updates and deletes a subcontractor against the real database", async () => {
    const { app } = buildApp();

    const createRes = await app.request("/subcontractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Integration Groundworks Ltd",
        trade: "Groundworks",
        cisStatus: "unverified",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as any;
    expect(created.id).toBeTruthy();
    expect(created.companyName).toBe("Integration Groundworks Ltd");

    const getRes = await app.request(`/subcontractors/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as any;
    expect(fetched.trade).toBe("Groundworks");

    const patchRes = await app.request(`/subcontractors/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "07000 000000" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.phone).toBe("07000 000000");

    const [persisted] = await db
      .select()
      .from(subcontractorsTable)
      .where(eq(subcontractorsTable.id, created.id));
    expect(persisted?.phone).toBe("07000 000000");

    const deleteRes = await app.request(`/subcontractors/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await app.request(`/subcontractors/${created.id}`);
    expect(getAfterDelete.status).toBe(404);

    const rowsAfterDelete = await db
      .select()
      .from(subcontractorsTable)
      .where(eq(subcontractorsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});

describe("PATCH /subcontractors/:id admin-only field gating", () => {
  // The old Postgres suite relied on a subcontractor seeded by seed.ts; the
  // local D1 test database only has migrations applied, so create one
  // directly here.
  let existing: typeof subcontractorsTable.$inferSelect;
  beforeAll(async () => {
    [existing] = await db
      .insert(subcontractorsTable)
      .values({
        id: "subcontractor-gating-fixture",
        companyName: "Fixture Ltd",
      })
      .onConflictDoUpdate({
        target: subcontractorsTable.id,
        set: { companyName: "Fixture Ltd" },
      })
      .returning();
  });

  it("rejects a manager attempting to change CIS-sensitive fields, but allows self-service fields", async () => {
    const { app, state } = buildApp();

    state.role = "manager";
    const forbiddenRes = await app.request(`/subcontractors/${existing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cisDeductionRate: 0 }),
    });
    expect(forbiddenRes.status).toBe(403);

    const [unchanged] = await db
      .select()
      .from(subcontractorsTable)
      .where(eq(subcontractorsTable.id, existing.id));
    expect(unchanged?.cisDeductionRate).toBe(existing.cisDeductionRate);

    state.role = "manager";
    const allowedRes = await app.request(`/subcontractors/${existing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Manager-editable note" }),
    });
    expect(allowedRes.status).toBe(200);
    const allowed = (await allowedRes.json()) as any;
    expect(allowed.notes).toBe("Manager-editable note");
  });

  it("allows an admin to change CIS-sensitive fields", async () => {
    const { app } = buildApp();

    const createRes = await app.request("/subcontractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Admin CIS Test Ltd" }),
    });
    const created = (await createRes.json()) as any;

    const patchRes = await app.request(`/subcontractors/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cisStatus: "gross",
        cisDeductionRate: 0,
        utrNumber: "1111 22222 33",
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.cisStatus).toBe("gross");
    expect(patched.cisDeductionRate).toBe(0);
    expect(patched.utrNumber).toBe("1111 22222 33");

    await app.request(`/subcontractors/${created.id}`, { method: "DELETE" });
  });
});
