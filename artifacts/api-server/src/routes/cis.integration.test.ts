import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, invoicesTable, subcontractorsTable } from "@workspace/db";
import cisRouter from "./cis";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched. cisRouter is mounted directly (rather than the full app.ts)
 * so no real Clerk network calls or CORS/rate-limit middleware are
 * involved - the routes/index.ts auth guard this bypasses is exercised
 * separately.
 *
 * cis.ts is the CIS300 return grouping query (see that file for the raw
 * SQL and why it's an INNER JOIN, not a LEFT JOIN) - this is the product's
 * core HMRC-compliance feature, so getting the aggregation right matters
 * more here than almost anywhere else in the app.
 */
function buildApp(role: "admin" | "manager" | "foreman" = "admin") {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", createDb(env.DB));
    c.set("userId", "integration-test-user");
    c.set("_role", role);
    c.set("logger", {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as never);
    await next();
  });
  app.route("/", cisRouter);
  return app;
}

const db = createDb(env.DB);

async function seedSubcontractor(
  overrides: Partial<typeof subcontractorsTable.$inferInsert> = {},
) {
  const id = generateId();
  await db.insert(subcontractorsTable).values({
    id,
    companyName: "Test Groundworks Ltd",
    cisStatus: "net",
    cisDeductionRate: 20,
    active: true,
    ...overrides,
  });
  return id;
}

async function seedInvoice(
  overrides: Partial<typeof invoicesTable.$inferInsert> & {
    subcontractorId: string;
  },
) {
  const id = generateId();
  await db.insert(invoicesTable).values({
    id,
    invoiceNumber: `INV-TEST-${id.slice(0, 8)}`,
    status: "paid",
    issuedDate: "2026-04-15",
    subtotal: 0,
    vatAmount: 0,
    totalAmount: 0,
    ...overrides,
  });
  return id;
}

describe("GET /cis/returns", () => {
  it("requires at least manager role", async () => {
    const app = buildApp("foreman");
    const res = await app.request("/cis/returns");
    expect(res.status).toBe(403);
  });

  it("groups paid invoices by tax month and subcontractor, summing gross/deducted/net", async () => {
    const subId = await seedSubcontractor({
      companyName: "CIS Returns Ltd",
      utrNumber: "1234567890",
      cisStatus: "net",
      cisDeductionRate: 20,
    });
    await seedInvoice({
      subcontractorId: subId,
      issuedDate: "2026-05-10",
      status: "paid",
      totalAmount: 1000,
      cisDeduction: 200,
    });
    await seedInvoice({
      subcontractorId: subId,
      issuedDate: "2026-05-22",
      status: "paid",
      totalAmount: 500,
      cisDeduction: 100,
    });

    const app = buildApp();
    const res = await app.request("/cis/returns");
    expect(res.status).toBe(200);
    const rows = (await res.json()) as any;

    const row = rows.find(
      (r: any) =>
        r.company_name === "CIS Returns Ltd" && r.period === "2026-05",
    );
    expect(row).toBeTruthy();
    expect(row.gross_payment).toBe(1500);
    expect(row.cis_deducted).toBe(300);
    expect(row.net_payment).toBe(1200);
    expect(row.invoice_count).toBe(2);
    expect(row.utr_number).toBe("1234567890");
  });

  it("excludes unpaid invoices from the return", async () => {
    const subId = await seedSubcontractor({
      companyName: "Unpaid Invoice Ltd",
    });
    await seedInvoice({
      subcontractorId: subId,
      issuedDate: "2026-06-01",
      status: "draft",
      totalAmount: 5000,
      cisDeduction: 1000,
    });

    const app = buildApp();
    const res = await app.request("/cis/returns");
    const rows = (await res.json()) as any;

    expect(
      rows.find((r: any) => r.company_name === "Unpaid Invoice Ltd"),
    ).toBeUndefined();
  });

  it("excludes invoices belonging to inactive subcontractors", async () => {
    const subId = await seedSubcontractor({
      companyName: "Inactive Sub Ltd",
      active: false,
    });
    await seedInvoice({
      subcontractorId: subId,
      issuedDate: "2026-06-05",
      status: "paid",
      totalAmount: 800,
      cisDeduction: 160,
    });

    const app = buildApp();
    const res = await app.request("/cis/returns");
    const rows = (await res.json()) as any;

    expect(
      rows.find((r: any) => r.company_name === "Inactive Sub Ltd"),
    ).toBeUndefined();
  });

  it("treats a null cis_deduction as zero rather than nulling out the whole sum", async () => {
    const subId = await seedSubcontractor({ companyName: "No Deduction Ltd" });
    await seedInvoice({
      subcontractorId: subId,
      issuedDate: "2026-07-01",
      status: "paid",
      totalAmount: 300,
      cisDeduction: null,
    });

    const app = buildApp();
    const res = await app.request("/cis/returns");
    const rows = (await res.json()) as any;

    const row = rows.find((r: any) => r.company_name === "No Deduction Ltd");
    expect(row).toBeTruthy();
    expect(row.cis_deducted).toBe(0);
    expect(row.net_payment).toBe(300);
  });
});
