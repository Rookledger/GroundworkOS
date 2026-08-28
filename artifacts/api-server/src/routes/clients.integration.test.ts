import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import clientsRouter from "./clients";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched. clientsRouter is mounted directly (rather than
 * the full app.ts) so no real Clerk network calls or CORS/rate-limit
 * middleware are involved - the routes/index.ts auth guard this bypasses is
 * exercised separately.
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
  app.route("/", clientsRouter);
  return app;
}

const db = createDb(env.DB);

describe("full write cycle for /clients/:id", () => {
  it("creates, reads, updates and deletes a client against the real database", async () => {
    const app = buildApp();

    const createRes = await app.request("/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Integration Test Ltd",
        contactName: "Ada Lovelace",
        email: "ada@example.com",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.companyName).toBe("Integration Test Ltd");
    // A brand-new client has no jobs yet, so the join-derived stats must be
    // zeroed rather than left undefined or null.
    expect(created.totalJobs).toBe(0);
    expect(created.totalValue).toBe(0);

    const getRes = await app.request(`/clients/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.companyName).toBe("Integration Test Ltd");
    expect(fetched.contactName).toBe("Ada Lovelace");

    const patchRes = await app.request(`/clients/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Integration Test Holdings Ltd" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.companyName).toBe("Integration Test Holdings Ltd");

    const [persisted] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, created.id));
    expect(persisted?.companyName).toBe("Integration Test Holdings Ltd");
    // contactName was not part of the PATCH body, so it must survive untouched.
    expect(persisted?.contactName).toBe("Ada Lovelace");

    const deleteRes = await app.request(`/clients/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await app.request(`/clients/${created.id}`);
    expect(getAfterDelete.status).toBe(404);

    const rowsAfterDelete = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
