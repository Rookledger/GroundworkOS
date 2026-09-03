import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, lineItemsTable, quotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import quotesRouter from "./quotes";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched. quotesRouter is mounted directly (rather than
 * the full app.ts) so no real Clerk network calls or CORS/rate-limit
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
  app.route("/", quotesRouter);
  return app;
}

const db = createDb(env.DB);

describe("POST /quotes", () => {
  it("generates a quote number for the current year", async () => {
    const app = buildApp();
    const year = new Date().getFullYear();

    const res = await app.request("/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Integration test quote" }),
    });

    expect(res.status).toBe(201);
    const quote = (await res.json()) as any;

    expect(quote.quoteNumber).toMatch(new RegExp(`^QT-${year}-\\d+$`));

    const rows = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.quoteNumber, quote.quoteNumber));
    expect(rows).toHaveLength(1);
  });

  it("recomputes subtotal/vat/total from line items server-side rather than trusting client totals", async () => {
    const app = buildApp();
    const res = await app.request("/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Line item pricing quote",
        lineItems: [
          {
            description: "Trench excavation",
            quantity: 10,
            unit: "m",
            unitPrice: 25,
          },
          {
            description: "Site visit",
            quantity: 1,
            unit: "Item",
            unitPrice: 50,
          },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const quote = (await res.json()) as any;

    // 10*25 + 1*50 = 300, VAT at 20% = 60, total = 360.
    expect(quote.subtotal).toBe(300);
    expect(quote.vatAmount).toBe(60);
    expect(quote.totalAmount).toBe(360);
    expect(quote.lineItems).toHaveLength(2);

    const persistedItems = await db
      .select()
      .from(lineItemsTable)
      .where(eq(lineItemsTable.quoteId, quote.id));
    expect(persistedItems).toHaveLength(2);
    expect(
      persistedItems.find((li) => li.description === "Trench excavation")
        ?.total,
    ).toBe(250);
  });

  it("defaults totals to zero when no line items are supplied", async () => {
    const app = buildApp();
    const res = await app.request("/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Empty quote" }),
    });
    expect(res.status).toBe(201);
    const quote = (await res.json()) as any;
    expect(quote.subtotal).toBe(0);
    expect(quote.vatAmount).toBe(0);
    expect(quote.totalAmount).toBe(0);
    expect(quote.lineItems).toHaveLength(0);
  });
});

describe("full write cycle for /quotes/:id", () => {
  it("creates, reads, updates (replacing line items) and deletes a quote, cascading its line items", async () => {
    const app = buildApp();

    const createRes = await app.request("/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Cycle quote",
        status: "draft",
        lineItems: [
          {
            description: "Initial item",
            quantity: 2,
            unit: "No",
            unitPrice: 10,
          },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as any;
    expect(created.subtotal).toBe(20);

    const getRes = await app.request(`/quotes/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as any;
    expect(fetched.lineItems).toHaveLength(1);

    // Replacing line items on PATCH must delete the old rows and re-price
    // from the new set, not append to the existing ones.
    const patchRes = await app.request(`/quotes/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "sent",
        lineItems: [
          {
            description: "Replacement item",
            quantity: 4,
            unit: "No",
            unitPrice: 100,
          },
        ],
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.status).toBe("sent");
    expect(patched.subtotal).toBe(400);
    expect(patched.vatAmount).toBe(80);
    expect(patched.totalAmount).toBe(480);
    expect(patched.lineItems).toHaveLength(1);
    expect(patched.lineItems[0].description).toBe("Replacement item");

    const persistedItems = await db
      .select()
      .from(lineItemsTable)
      .where(eq(lineItemsTable.quoteId, created.id));
    expect(persistedItems).toHaveLength(1);
    expect(persistedItems[0]?.description).toBe("Replacement item");

    const [persistedQuote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, created.id));
    expect(persistedQuote?.status).toBe("sent");
    expect(persistedQuote?.subtotal).toBe(400);

    const deleteRes = await app.request(`/quotes/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await app.request(`/quotes/${created.id}`);
    expect(getAfterDelete.status).toBe(404);

    const rowsAfterDelete = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);

    // The line items must be cascade-deleted along with the quote, not left
    // as orphaned rows referencing a quote that no longer exists.
    const orphanedLineItems = await db
      .select()
      .from(lineItemsTable)
      .where(eq(lineItemsTable.quoteId, created.id));
    expect(orphanedLineItems).toHaveLength(0);
  });
});
