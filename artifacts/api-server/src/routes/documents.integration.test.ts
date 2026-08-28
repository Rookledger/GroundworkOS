import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import documentsRouter from "./documents";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched. documentsRouter is mounted directly (rather
 * than the full app.ts) so no real Clerk network calls, R2, or
 * CORS/rate-limit middleware are involved.
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
  app.route("/", documentsRouter);
  return app;
}

const db = createDb(env.DB);

function daysFromNow(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

describe("POST /documents status derivation", () => {
  it("marks a document with no expiry as valid", async () => {
    const app = buildApp();
    const res = await app.request("/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No-expiry cert", type: "certification" }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.status).toBe("valid");
  });

  it("marks a document with an expiry in the past as expired", async () => {
    const app = buildApp();
    const res = await app.request("/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Lapsed insurance",
        type: "insurance",
        expiryDate: "2020-01-01",
      }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.status).toBe("expired");
  });

  it("marks a document expiring within 30 days as expiring_soon", async () => {
    const app = buildApp();
    const res = await app.request("/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Soon-to-lapse permit",
        type: "permit",
        expiryDate: daysFromNow(10),
      }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.status).toBe("expiring_soon");
  });

  it("marks a document expiring more than 30 days out as valid", async () => {
    const app = buildApp();
    const res = await app.request("/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Far-future permit",
        type: "permit",
        expiryDate: daysFromNow(60),
      }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.status).toBe("valid");
  });
});

describe("full write cycle for /documents/:id", () => {
  it("creates, lists, updates (recomputing status from expiryDate) and deletes a document", async () => {
    const app = buildApp();

    const createRes = await app.request("/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cycle document",
        type: "certification",
        expiryDate: daysFromNow(60),
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.status).toBe("valid");

    // Documents has no GET /:id route; confirm the created row is visible
    // through the list endpoint instead.
    const listRes = await app.request("/documents");
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.some((d: any) => d.id === created.id)).toBe(true);

    // Moving expiryDate into the past must flip status to expired, proving
    // computeDocStatus() re-runs on update rather than only on create.
    const patchRes = await app.request(`/documents/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiryDate: "2020-01-01" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.status).toBe("expired");

    const [persisted] = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, created.id));
    expect(persisted?.status).toBe("expired");
    expect(persisted?.expiryDate).toBe("2020-01-01");

    const deleteRes = await app.request(`/documents/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
