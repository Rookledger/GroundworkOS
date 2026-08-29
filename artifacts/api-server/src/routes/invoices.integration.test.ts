import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, invoicesTable, subcontractorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import invoicesRouter from "./invoices";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched. invoicesRouter is mounted directly (rather
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
  app.route("/", invoicesRouter);
  return app;
}

const db = createDb(env.DB);

// The old Postgres suite relied on a subcontractor seeded by seed.ts
// (id "s2", 20% CIS deduction rate); the local D1 test database only has
// migrations applied, so create the same fixture directly here instead.
beforeAll(async () => {
  await db
    .insert(subcontractorsTable)
    .values({
      id: "s2",
      companyName: "J&T Plant Hire",
      cisDeductionRate: 20,
    })
    .onConflictDoNothing();
});

describe("POST /invoices", () => {
  it("generates an invoice number for the current year", async () => {
    const app = buildApp();
    const year = new Date().getFullYear();

    const res = await app.request("/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issuedDate: "2026-06-01", subtotal: 500 }),
    });

    expect(res.status).toBe(201);
    const invoice = await res.json();

    expect(invoice.invoiceNumber).toMatch(new RegExp(`^INV-${year}-\\d+$`));

    const rows = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.invoiceNumber, invoice.invoiceNumber));
    expect(rows).toHaveLength(1);
  });

  it("recomputes VAT/total server-side and leaves cisDeduction null with no subcontractor", async () => {
    const app = buildApp();
    const res = await app.request("/invoices", {
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
    const app = buildApp();
    // Subcontractor s2 (J&T Plant Hire, seeded above) has cisDeductionRate 20.
    const res = await app.request("/invoices", {
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

describe("full write cycle for /invoices/:id", () => {
  it("creates, reads, updates and deletes an invoice against the real database", async () => {
    const app = buildApp();

    const createRes = await app.request("/invoices", {
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

    const getRes = await app.request(`/invoices/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.subtotal).toBe(1000);

    // A partial update that touches neither subtotal nor subcontractorId must
    // leave the previously-computed financial fields untouched.
    const statusOnlyPatch = await app.request(`/invoices/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" }),
    });
    expect(statusOnlyPatch.status).toBe(200);
    const statusPatched = await statusOnlyPatch.json();
    expect(statusPatched.status).toBe("sent");
    expect(statusPatched.subtotal).toBe(1000);
    expect(statusPatched.vatAmount).toBe(200);
    expect(statusPatched.cisDeduction).toBe(200);

    // Updating subtotal alone must re-derive vat/total/cisDeduction using the
    // invoice's existing (unsent) subcontractorId, not drop the CIS deduction.
    const subtotalPatch = await app.request(`/invoices/${created.id}`, {
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

    const deleteRes = await app.request(`/invoices/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await app.request(`/invoices/${created.id}`);
    expect(getAfterDelete.status).toBe(404);

    const rowsAfterDelete = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});

describe("PATCH /invoices/:id — mark as paid", () => {
  it("accepts a status+paidAt partial update (as sent by InvoicesPage's markPaid) and stores paidAt as a real timestamp", async () => {
    const app = buildApp();

    const createRes = await app.request("/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issuedDate: "2026-06-01", subtotal: 500 }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Mirrors InvoicesPage.tsx's markPaid(): `paidAt: new Date().toISOString()`
    // sent alongside `status`, with no `subtotal`/`subcontractorId` in the
    // body. This used to throw a 500 because the raw ISO string was passed
    // straight into a Drizzle `timestamp_ms`-mode column update.
    const paidAt = new Date().toISOString();
    const patchRes = await app.request(`/invoices/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", paidAt }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.status).toBe("paid");
    expect(new Date(patched.paidAt).toISOString()).toBe(paidAt);

    const [persisted] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, created.id));
    expect(persisted?.paidAt).toBeInstanceOf(Date);
    expect(persisted?.paidAt?.toISOString()).toBe(paidAt);
  });
});
