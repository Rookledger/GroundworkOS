import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, jobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import jobsRouter from "./jobs";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Clerk is stubbed here rather than in
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched; only this test's identity/role for `c.get("clerk")` and
 * `c.get("userId")` differs. jobsRouter is mounted directly (rather than
 * the full app.ts) so no real Clerk network calls or CORS/rate-limit
 * middleware are involved - the routes/index.ts auth guard this bypasses is
 * exercised separately.
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
    // getAuth(c) (@hono/clerk-auth) reads this off the context - only the
    // real clerkMiddleware (not run here; identity is injected above
    // instead) normally sets it. logAudit's best-effort attribution calls
    // getAuth(c), so give it a harmless no-op rather than leaving it
    // undefined (which getAuth calls as a function and throws on).
    c.set("clerkAuth", (() => undefined) as never);
    await next();
  });
  app.route("/", jobsRouter);
  return app;
}

const db = createDb(env.DB);

describe("POST /jobs", () => {
  it("generates a job number for the current year, starting a fresh sequence", async () => {
    const app = buildApp();
    const year = new Date().getFullYear();

    const res = await app.request("/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Integration test job" }),
    });

    expect(res.status).toBe(201);
    const job = await res.json();
    expect(job.jobNumber).toMatch(new RegExp(`^GW-${year}-\\d+$`));
  });

  it("never reuses a job number for two jobs created back to back", async () => {
    const app = buildApp();

    const first = await (
      await app.request("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "First" }),
      })
    ).json();
    const second = await (
      await app.request("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Second" }),
      })
    ).json();

    expect(first.jobNumber).not.toBe(second.jobNumber);
  });
});

describe("full write cycle for /jobs/:id", () => {
  it("creates, reads, updates and deletes a job against the real database", async () => {
    const app = buildApp();

    const createRes = await app.request("/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Integration cycle job",
        status: "enquiry",
        value: 1000,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.title).toBe("Integration cycle job");
    expect(created.status).toBe("enquiry");

    const getRes = await app.request(`/jobs/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.id).toBe(created.id);
    expect(fetched.title).toBe("Integration cycle job");

    const patchRes = await app.request(`/jobs/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active", progressPercent: 40 }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.status).toBe("active");
    expect(patched.progressPercent).toBe(40);

    const [persisted] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, created.id));
    expect(persisted?.status).toBe("active");
    expect(persisted?.progressPercent).toBe(40);

    const deleteRes = await app.request(`/jobs/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await app.request(`/jobs/${created.id}`);
    expect(getAfterDelete.status).toBe(404);

    const rowsAfterDelete = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
