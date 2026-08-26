import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, jobsTable, plantTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import plantRouter from "./plant";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Clerk is stubbed here rather than in
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched; only this test's identity/role for `c.get("clerk")` and
 * `c.get("userId")` differs. plantRouter is mounted directly (rather than
 * the full app.ts) so no real Clerk network calls or CORS/rate-limit
 * middleware are involved.
 */
function buildApp() {
  const clerk = {
    users: {
      getUser: vi
        .fn()
        .mockResolvedValue({ publicMetadata: { role: "admin" } }),
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
  app.route("/", plantRouter);
  return app;
}

const db = createDb(env.DB);

// The old Postgres suite relied on a job seeded by seed.ts; the local D1
// test database only has migrations applied, so create one directly here.
let job: typeof jobsTable.$inferSelect;
beforeAll(async () => {
  [job] = await db
    .insert(jobsTable)
    .values({
      id: "plant-test-job",
      jobNumber: "GW-TEST-PLANT",
      title: "Plant fixture job",
    })
    .onConflictDoUpdate({
      target: jobsTable.id,
      set: { title: "Plant fixture job" },
    })
    .returning();
});

describe("full write cycle for /plant/:id", () => {
  it("creates, lists (enriched with currentJobTitle), updates and deletes a plant item", async () => {
    const app = buildApp();

    const createRes = await app.request("/plant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Integration Test Excavator",
        category: "Excavator",
        status: "on_site",
        currentJobId: job.id,
        dailyRate: 250,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.currentJobTitle).toBe(job.title);

    // Plant has no GET /:id route; confirm the created row via the list
    // endpoint instead.
    const listRes = await app.request("/plant");
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const fetched = list.find((p: any) => p.id === created.id);
    expect(fetched).toBeTruthy();
    expect(fetched.name).toBe("Integration Test Excavator");

    const patchRes = await app.request(`/plant/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "maintenance", dailyRate: 300 }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.status).toBe("maintenance");
    expect(patched.dailyRate).toBe(300);
    // currentJobId was not part of the PATCH body, so the enrichment must
    // still reflect the job set at create time.
    expect(patched.currentJobTitle).toBe(job.title);

    const [persisted] = await db
      .select()
      .from(plantTable)
      .where(eq(plantTable.id, created.id));
    expect(persisted?.status).toBe("maintenance");
    expect(persisted?.dailyRate).toBe(300);

    const deleteRes = await app.request(`/plant/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(plantTable)
      .where(eq(plantTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
