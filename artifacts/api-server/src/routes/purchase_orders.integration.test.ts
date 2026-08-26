import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, purchaseOrdersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import purchaseOrdersRouter from "./purchase_orders";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Clerk is stubbed here rather than in
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched; only this test's identity/role for `c.get("clerk")` and
 * `c.get("userId")` differs. purchaseOrdersRouter is mounted directly
 * (rather than the full app.ts) so no real Clerk network calls or
 * CORS/rate-limit middleware are involved.
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
  app.route("/", purchaseOrdersRouter);
  return app;
}

const db = createDb(env.DB);

describe("POST /purchase-orders sequence numbering", () => {
  // The fresh D1 test database has no id_counters row for this table (only
  // migrations are applied, no seed data), so the first POST here exercises
  // nextSeqNumber()'s INSERT branch of `INSERT ... ON CONFLICT DO UPDATE`
  // rather than the DO UPDATE branch every other resource's tests exercise.
  it("allocates distinct, sequential PO numbers with no pre-existing counter row", async () => {
    const app = buildApp();
    const year = new Date().getFullYear();

    const makePO = () =>
      app.request("/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: "Integration Supplier Ltd",
          description: "Test order",
          orderDate: "2026-06-01",
        }),
      });

    const firstRes = await makePO();
    expect(firstRes.status).toBe(201);
    const first = await firstRes.json();
    expect(first.poNumber).toMatch(new RegExp(`^PO-${year}-\\d+$`));

    const secondRes = await makePO();
    expect(secondRes.status).toBe(201);
    const second = await secondRes.json();
    expect(second.poNumber).toMatch(new RegExp(`^PO-${year}-\\d+$`));

    expect(second.poNumber).not.toBe(first.poNumber);
    const firstSeq = Number(first.poNumber.split("-").pop());
    const secondSeq = Number(second.poNumber.split("-").pop());
    expect(secondSeq).toBe(firstSeq + 1);

    const rows = await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.poNumber, first.poNumber));
    expect(rows).toHaveLength(1);
  });
});

describe("POST /purchase-orders financial computation", () => {
  it("derives vatAmount and totalAmount from amount when not supplied", async () => {
    const app = buildApp();
    const res = await app.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier: "Integration Supplier Ltd",
        description: "Materials",
        orderDate: "2026-06-01",
        amount: 500,
      }),
    });
    expect(res.status).toBe(201);
    const po = await res.json();
    expect(po.amount).toBe(500);
    expect(po.vatAmount).toBe(100);
    expect(po.totalAmount).toBe(600);
  });
});

describe("full write cycle for /purchase-orders/:id", () => {
  it("creates, lists, updates (recomputing VAT/total) and deletes a purchase order", async () => {
    const app = buildApp();

    const createRes = await app.request("/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier: "Cycle Supplier Ltd",
        description: "Cycle test order",
        orderDate: "2026-06-01",
        amount: 500,
        status: "draft",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.totalAmount).toBe(600);

    // Purchase orders has no GET /:id route; confirm the created row via the
    // list endpoint instead.
    const listRes = await app.request("/purchase-orders");
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const fetched = list.find((p: any) => p.id === created.id);
    expect(fetched).toBeTruthy();
    expect(fetched.supplier).toBe("Cycle Supplier Ltd");

    const patchRes = await app.request(`/purchase-orders/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1000, status: "ordered" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.status).toBe("ordered");
    expect(patched.amount).toBe(1000);
    expect(patched.vatAmount).toBe(200);
    expect(patched.totalAmount).toBe(1200);

    const [persisted] = await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, created.id));
    expect(persisted?.amount).toBe(1000);
    expect(persisted?.totalAmount).toBe(1200);
    expect(persisted?.status).toBe("ordered");

    const deleteRes = await app.request(`/purchase-orders/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
