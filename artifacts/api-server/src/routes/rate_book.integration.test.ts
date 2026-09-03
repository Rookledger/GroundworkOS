import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, rateBookTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import rateBookRouter from "./rate_book";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched. rateBookRouter is mounted directly (rather
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
  app.route("/", rateBookRouter);
  return app;
}

const db = createDb(env.DB);

describe("full write cycle for /rate-book/:id", () => {
  it("creates, lists, updates and deletes a rate book entry against the real database", async () => {
    const app = buildApp();

    const createRes = await app.request("/rate-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "Integration",
        description: "Integration test rate",
        unit: "m²",
        labourRate: 10,
        materialRate: 5,
        plantRate: 2,
        totalRate: 17,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as any;
    expect(created.totalRate).toBe(17);

    // Rate book has no GET /:id route; confirm the created row via the list
    // endpoint instead.
    const listRes = await app.request("/rate-book");
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as any;
    const fetched = list.find((e: any) => e.id === created.id);
    expect(fetched).toBeTruthy();
    expect(fetched.description).toBe("Integration test rate");

    const patchRes = await app.request(`/rate-book/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labourRate: 20, totalRate: 27 }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.labourRate).toBe(20);
    expect(patched.totalRate).toBe(27);

    const [persisted] = await db
      .select()
      .from(rateBookTable)
      .where(eq(rateBookTable.id, created.id));
    expect(persisted?.labourRate).toBe(20);
    expect(persisted?.totalRate).toBe(27);

    const deleteRes = await app.request(`/rate-book/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(rateBookTable)
      .where(eq(rateBookTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
