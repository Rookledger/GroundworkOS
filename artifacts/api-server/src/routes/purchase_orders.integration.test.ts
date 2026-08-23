import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration test: boots the real Express app against a real Postgres
 * database (DATABASE_URL must already point at a migrated + seeded
 * database — see .github/workflows/ci.yml). Clerk is stubbed out here
 * rather than in routes/index.ts or lib/auth.ts, so production auth code
 * is completely untouched; only this test's view of "@clerk/express"
 * differs.
 */
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: () => ({ userId: "integration-test-user" }),
  clerkClient: {
    users: {
      getUser: vi.fn().mockResolvedValue({ publicMetadata: { role: "admin" } }),
    },
  },
}));

// The object storage route constructs an S3 client at import time; it's
// never exercised by this test, but the module graph still needs these set.
process.env.S3_BUCKET ??= "test-bucket";
process.env.S3_ACCESS_KEY_ID ??= "test-access-key";
process.env.S3_SECRET_ACCESS_KEY ??= "test-secret-key";

const { default: app } = await import("../app");
const { db, purchaseOrdersTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("POST /api/purchase-orders sequence numbering", () => {
  // Unlike jobs/quotes/invoices, seed.ts never inserts any purchase_orders
  // rows and never syncs an id_counters("purchase_orders:<year>") baseline
  // (see syncSeqCounter calls in seed.ts, which cover jobs/quotes/invoices
  // only). So a fresh database has NO id_counters row for this table at all,
  // meaning the very first POST here exercises nextSeqNumber()'s INSERT
  // branch of `INSERT ... ON CONFLICT DO UPDATE` rather than the DO UPDATE
  // branch every other resource's tests exercise. That first-call path, and
  // the atomicity of the very next call immediately after it, had no test
  // coverage before this file.
  it("allocates distinct, sequential PO numbers with no pre-existing counter row", async () => {
    const year = new Date().getFullYear();

    const makePO = () =>
      fetch(`${baseUrl}/api/purchase-orders`, {
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

describe("POST /api/purchase-orders financial computation", () => {
  it("derives vatAmount and totalAmount from amount when not supplied", async () => {
    const res = await fetch(`${baseUrl}/api/purchase-orders`, {
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

describe("full write cycle for /api/purchase-orders/:id", () => {
  it("creates, lists, updates (recomputing VAT/total) and deletes a purchase order", async () => {
    const createRes = await fetch(`${baseUrl}/api/purchase-orders`, {
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
    const listRes = await fetch(`${baseUrl}/api/purchase-orders`);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const fetched = list.find((p: any) => p.id === created.id);
    expect(fetched).toBeTruthy();
    expect(fetched.supplier).toBe("Cycle Supplier Ltd");

    const patchRes = await fetch(
      `${baseUrl}/api/purchase-orders/${created.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 1000, status: "ordered" }),
      },
    );
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

    const deleteRes = await fetch(
      `${baseUrl}/api/purchase-orders/${created.id}`,
      { method: "DELETE" },
    );
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
