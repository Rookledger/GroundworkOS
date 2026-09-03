import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, jobsTable, scheduleEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import scheduleRouter from "./schedule";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched. scheduleRouter is mounted directly (rather
 * than the full app.ts) so no real Clerk network calls or CORS/rate-limit
 * middleware are involved.
 */
function buildApp() {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", createDb(env.DB));
    c.set("userId", "integration-test-user");
    c.set("_role", "admin");
    c.set("logger", {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as never);
    await next();
  });
  app.route("/", scheduleRouter);
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
      id: "schedule-test-job",
      jobNumber: "GW-TEST-SCHED",
      title: "Schedule fixture job",
    })
    .onConflictDoUpdate({
      target: jobsTable.id,
      set: { title: "Schedule fixture job" },
    })
    .returning();
});

describe("full write cycle for /schedule/:id", () => {
  it("creates, lists (enriched with job/client), updates and deletes a schedule entry", async () => {
    const app = buildApp();

    const createRes = await app.request("/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        title: "Integration cycle entry",
        startDatetime: "2026-06-01T07:00:00.000Z",
        endDatetime: "2026-06-01T15:00:00.000Z",
        crewCount: 3,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as any;
    expect(created.jobNumber).toBe(job.jobNumber);
    expect(created.jobTitle).toBe(job.title);
    expect(created.startDatetime).toBe("2026-06-01T07:00:00.000Z");
    expect(created.endDatetime).toBe("2026-06-01T15:00:00.000Z");

    // Schedule has no GET /:id route; confirm the created row via the list
    // endpoint instead.
    const listRes = await app.request("/schedule");
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as any;
    const fetched = list.find((e: any) => e.id === created.id);
    expect(fetched).toBeTruthy();
    expect(fetched.title).toBe("Integration cycle entry");

    const patchRes = await app.request(`/schedule/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDatetime: "2026-06-02T08:00:00.000Z",
        crewCount: 5,
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.startDatetime).toBe("2026-06-02T08:00:00.000Z");
    expect(patched.crewCount).toBe(5);
    // endDatetime was not part of the PATCH body, so it must survive untouched.
    expect(patched.endDatetime).toBe("2026-06-01T15:00:00.000Z");

    const [persisted] = await db
      .select()
      .from(scheduleEntriesTable)
      .where(eq(scheduleEntriesTable.id, created.id));
    expect(persisted?.crewCount).toBe(5);
    expect(persisted?.startDatetime.toISOString()).toBe(
      "2026-06-02T08:00:00.000Z",
    );

    const deleteRes = await app.request(`/schedule/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(scheduleEntriesTable)
      .where(eq(scheduleEntriesTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
