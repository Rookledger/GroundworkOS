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
const { db, invoicesTable } = await import("@workspace/db");
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

describe("POST /api/invoices", () => {
  it("generates an invoice number that does not collide with any seeded invoice number", async () => {
    // Same year derivation as lib/generateId.ts's nextSeqNumber() and
    // seed.ts, so this assertion holds regardless of which calendar year
    // the suite happens to run in.
    const year = new Date().getFullYear();

    const seededInvoices = await db
      .select({ invoiceNumber: invoicesTable.invoiceNumber })
      .from(invoicesTable);
    expect(seededInvoices.length).toBeGreaterThan(0);
    expect(
      seededInvoices.some((i) => i.invoiceNumber.startsWith(`INV-${year}-`)),
    ).toBe(true);
    const seededNumbers = new Set(seededInvoices.map((i) => i.invoiceNumber));

    const res = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issuedDate: "2026-06-01", subtotal: 500 }),
    });

    expect(res.status).toBe(201);
    const invoice = await res.json();

    expect(invoice.invoiceNumber).toMatch(new RegExp(`^INV-${year}-\\d+$`));
    expect(seededNumbers.has(invoice.invoiceNumber)).toBe(false);

    const rows = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.invoiceNumber, invoice.invoiceNumber));
    expect(rows).toHaveLength(1);
  });

  it("recomputes VAT/total server-side and leaves cisDeduction null with no subcontractor", async () => {
    const res = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issuedDate: "2026-06-01", subtotal: 1000 }),
    });
    expect(res.status).toBe(201);
    const invoice = await res.json();
    expect(invoice.subtotal).toBe(1000);
    expect(invoice.vatAmount).toBe(200);
    expect(invoice.totalAmount).toBe(1200);
    expect(invoice.cisDeduction).toBeNull();
  });

  it("derives cisDeduction from the linked subcontractor's on-file deduction rate, never a client-supplied value", async () => {
    // Seeded subcontractor s2 (J&T Plant Hire) has cisDeductionRate 20.
    const res = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issuedDate: "2026-06-01",
        subtotal: 1000,
        subcontractorId: "s2",
      }),
    });
    expect(res.status).toBe(201);
    const invoice = await res.json();
    expect(invoice.cisDeduction).toBe(200);
  });
});

describe("full write cycle for /api/invoices/:id", () => {
  it("creates, reads, updates and deletes an invoice against the real database", async () => {
    const createRes = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issuedDate: "2026-06-01",
        subtotal: 1000,
        subcontractorId: "s2",
        status: "draft",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.vatAmount).toBe(200);
    expect(created.cisDeduction).toBe(200);

    const getRes = await fetch(`${baseUrl}/api/invoices/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.subtotal).toBe(1000);

    // A partial update that touches neither subtotal nor subcontractorId must
    // leave the previously-computed financial fields untouched.
    const statusOnlyPatch = await fetch(
      `${baseUrl}/api/invoices/${created.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      },
    );
    expect(statusOnlyPatch.status).toBe(200);
    const statusPatched = await statusOnlyPatch.json();
    expect(statusPatched.status).toBe("sent");
    expect(statusPatched.subtotal).toBe(1000);
    expect(statusPatched.vatAmount).toBe(200);
    expect(statusPatched.cisDeduction).toBe(200);

    // Updating subtotal alone must re-derive vat/total/cisDeduction using the
    // invoice's existing (unsent) subcontractorId, not drop the CIS deduction.
    const subtotalPatch = await fetch(`${baseUrl}/api/invoices/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtotal: 2000 }),
    });
    expect(subtotalPatch.status).toBe(200);
    const subtotalPatched = await subtotalPatch.json();
    expect(subtotalPatched.subtotal).toBe(2000);
    expect(subtotalPatched.vatAmount).toBe(400);
    expect(subtotalPatched.totalAmount).toBe(2400);
    expect(subtotalPatched.cisDeduction).toBe(400);

    const [persisted] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, created.id));
    expect(persisted?.subtotal).toBe(2000);
    expect(persisted?.cisDeduction).toBe(400);
    expect(persisted?.status).toBe("sent");

    const deleteRes = await fetch(`${baseUrl}/api/invoices/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/invoices/${created.id}`);
    expect(getAfterDelete.status).toBe(404);

    const rowsAfterDelete = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
