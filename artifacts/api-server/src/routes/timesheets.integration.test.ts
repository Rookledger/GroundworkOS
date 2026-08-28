import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, timesheetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import timesheetsRouter from "./timesheets";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched. timesheetsRouter is mounted directly (rather
 * than the full app.ts) so no real Clerk network calls or CORS/rate-limit
 * middleware are involved.
 */
function buildApp() {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", createDb(env.DB));
    c.set("userId", "integration-test-user");
    c.set("_role", "admin");
    c.set(
      "logger",
      { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } as never,
    );
    await next();
  });
  app.route("/", timesheetsRouter);
  return app;
}

const db = createDb(env.DB);

describe("POST /timesheets cost derivation", () => {
  it("derives cost from hoursWorked/8 * dayRate", async () => {
    const app = buildApp();
    const res = await app.request("/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerName: "Dave Walters",
        workDate: "2026-06-01",
        hoursWorked: 4,
        dayRate: 200,
      }),
    });
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.cost).toBe(100);
  });

  it("leaves cost null when no dayRate is supplied", async () => {
    const app = buildApp();
    const res = await app.request("/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerName: "Dave Walters",
        workDate: "2026-06-01",
        hoursWorked: 8,
      }),
    });
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.cost).toBeNull();
  });
});

describe("full write cycle for /timesheets/:id", () => {
  it("creates, lists, updates (recomputing cost from the existing dayRate) and deletes a timesheet", async () => {
    const app = buildApp();

    const createRes = await app.request("/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerName: "Colin Sharp",
        workDate: "2026-06-02",
        hoursWorked: 8,
        dayRate: 160,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.cost).toBe(160);

    // Timesheets has no GET /:id route; confirm the created row via the list
    // endpoint instead.
    const listRes = await app.request("/timesheets");
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.some((t: any) => t.id === created.id)).toBe(true);

    // Updating hoursWorked alone (no dayRate in the body) must re-derive cost
    // from the timesheet's existing dayRate, not null it out or leave it stale.
    const patchRes = await app.request(`/timesheets/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hoursWorked: 4 }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.hoursWorked).toBe(4);
    expect(patched.cost).toBe(80);

    const [persisted] = await db
      .select()
      .from(timesheetsTable)
      .where(eq(timesheetsTable.id, created.id));
    expect(persisted?.cost).toBe(80);
    expect(persisted?.dayRate).toBe(160);

    const deleteRes = await app.request(`/timesheets/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(timesheetsTable)
      .where(eq(timesheetsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
