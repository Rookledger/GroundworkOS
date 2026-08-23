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
const { db, quotesTable, lineItemsTable } = await import("@workspace/db");
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

describe("POST /api/quotes", () => {
  it("generates a quote number that does not collide with any seeded quote number", async () => {
    // Same year derivation as lib/generateId.ts's nextSeqNumber() and
    // seed.ts, so this assertion holds regardless of which calendar year
    // the suite happens to run in.
    const year = new Date().getFullYear();

    const seededQuotes = await db
      .select({ quoteNumber: quotesTable.quoteNumber })
      .from(quotesTable);
    expect(seededQuotes.length).toBeGreaterThan(0);
    expect(
      seededQuotes.some((q) => q.quoteNumber.startsWith(`QT-${year}-`)),
    ).toBe(true);
    const seededNumbers = new Set(seededQuotes.map((q) => q.quoteNumber));

    const res = await fetch(`${baseUrl}/api/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Integration test quote" }),
    });

    expect(res.status).toBe(201);
    const quote = await res.json();

    expect(quote.quoteNumber).toMatch(new RegExp(`^QT-${year}-\\d+$`));
    expect(seededNumbers.has(quote.quoteNumber)).toBe(false);

    const rows = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.quoteNumber, quote.quoteNumber));
    expect(rows).toHaveLength(1);
  });

  it("recomputes subtotal/vat/total from line items server-side rather than trusting client totals", async () => {
    const res = await fetch(`${baseUrl}/api/quotes`, {
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
    const quote = await res.json();

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
    const res = await fetch(`${baseUrl}/api/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Empty quote" }),
    });
    expect(res.status).toBe(201);
    const quote = await res.json();
    expect(quote.subtotal).toBe(0);
    expect(quote.vatAmount).toBe(0);
    expect(quote.totalAmount).toBe(0);
    expect(quote.lineItems).toHaveLength(0);
  });
});

describe("full write cycle for /api/quotes/:id", () => {
  it("creates, reads, updates (replacing line items) and deletes a quote, cascading its line items", async () => {
    const createRes = await fetch(`${baseUrl}/api/quotes`, {
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
    const created = await createRes.json();
    expect(created.subtotal).toBe(20);

    const getRes = await fetch(`${baseUrl}/api/quotes/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.lineItems).toHaveLength(1);

    // Replacing line items on PATCH must delete the old rows and re-price
    // from the new set, not append to the existing ones.
    const patchRes = await fetch(`${baseUrl}/api/quotes/${created.id}`, {
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
    const patched = await patchRes.json();
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

    const deleteRes = await fetch(`${baseUrl}/api/quotes/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/quotes/${created.id}`);
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
