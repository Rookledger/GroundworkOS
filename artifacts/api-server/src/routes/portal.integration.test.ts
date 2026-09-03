import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, quotesTable, lineItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import portalRouter from "./portal";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. portalRouter is mounted directly (rather than
 * the full app.ts) so no real Clerk network calls or CORS/rate-limit
 * middleware are involved.
 *
 * portal.ts is the one route file in this app that's reachable
 * *unauthenticated* - it's the public, shareable "approve this quote"
 * link a client gets by email, with no session/role required for GET,
 * /approve or /decline. Only POST /quotes/:id/share (which mints the
 * token) requires a manager session, so `buildApp()` here deliberately
 * does NOT set `userId`/`_role` by default, unlike every other route's
 * integration test - that's the actual shape of a real portal request.
 */
function buildApp(auth?: { role: "admin" | "manager" | "foreman" }) {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", createDb(env.DB));
    if (auth) {
      c.set("userId", "integration-test-user");
      c.set("_role", auth.role);
    }
    c.set("logger", {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as never);
    await next();
  });
  app.route("/", portalRouter);
  return app;
}

const db = createDb(env.DB);

async function seedQuote(
  overrides: Partial<typeof quotesTable.$inferInsert> = {},
) {
  const id = generateId();
  await db.insert(quotesTable).values({
    id,
    quoteNumber: `QT-TEST-${id.slice(0, 8)}`,
    status: "sent",
    subtotal: 100,
    vatAmount: 20,
    totalAmount: 120,
    shareToken: generateId(),
    ...overrides,
  });
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.id, id));
  return quote!;
}

describe("GET /portal/:token", () => {
  it("returns 404 for an unknown token, without requiring auth", async () => {
    const app = buildApp();
    const res = await app.request("/portal/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("returns the quote and its line items for a valid token", async () => {
    const quote = await seedQuote({ title: "Driveway resurfacing" });
    await db.insert(lineItemsTable).values({
      id: generateId(),
      quoteId: quote.id,
      description: "Tarmac driveway",
      quantity: 1,
      unit: "Item",
      unitPrice: 100,
      total: 100,
    });

    const app = buildApp();
    const res = await app.request(`/portal/${quote.shareToken}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.id).toBe(quote.id);
    expect(body.title).toBe("Driveway resurfacing");
    expect(body.totalAmount).toBe(120);
    expect(body.lineItems).toHaveLength(1);
  });
});

describe("POST /portal/:token/approve", () => {
  it("requires a name", async () => {
    const quote = await seedQuote();
    const app = buildApp();
    const res = await app.request(`/portal/${quote.shareToken}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "  " }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown token, without requiring auth", async () => {
    const app = buildApp();
    const res = await app.request("/portal/does-not-exist/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A Client" }),
    });
    expect(res.status).toBe(404);
  });

  it("accepts the quote and records who approved it, unauthenticated", async () => {
    const quote = await seedQuote();
    const app = buildApp();
    const res = await app.request(`/portal/${quote.shareToken}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jane Client" }),
    });
    expect(res.status).toBe(200);

    const [updated] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, quote.id));
    expect(updated?.status).toBe("accepted");
    expect(updated?.approvedByName).toBe("Jane Client");
    expect(updated?.approvedAt).toBeTruthy();
  });

  it("rejects approving a quote that's already been accepted", async () => {
    const quote = await seedQuote({
      status: "accepted",
      approvedByName: "First",
    });
    const app = buildApp();
    const res = await app.request(`/portal/${quote.shareToken}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Second Client" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /portal/:token/decline", () => {
  it("declines the quote, unauthenticated", async () => {
    const quote = await seedQuote();
    const app = buildApp();
    const res = await app.request(`/portal/${quote.shareToken}/decline`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const [updated] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, quote.id));
    expect(updated?.status).toBe("declined");
  });

  it("rejects declining a quote that's already been accepted", async () => {
    const quote = await seedQuote({
      status: "accepted",
      approvedByName: "Someone",
    });
    const app = buildApp();
    const res = await app.request(`/portal/${quote.shareToken}/decline`, {
      method: "POST",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /quotes/:id/share", () => {
  it("requires at least manager role", async () => {
    const quote = await seedQuote({ shareToken: null });
    const app = buildApp({ role: "foreman" });
    const res = await app.request(`/quotes/${quote.id}/share`, {
      method: "POST",
    });
    expect(res.status).toBe(403);
  });

  it("mints and persists a share token for a quote that doesn't have one yet", async () => {
    const quote = await seedQuote({ shareToken: null });
    const app = buildApp({ role: "manager" });
    const res = await app.request(
      `/quotes/${quote.id}/share`,
      { method: "POST" },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.token).toBeTruthy();
    expect(body.url).toContain(`/portal/${body.token}`);

    const [updated] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, quote.id));
    expect(updated?.shareToken).toBe(body.token);
  });

  it("reuses the existing share token rather than minting a new one", async () => {
    const quote = await seedQuote({ shareToken: "already-has-a-token" });
    const app = buildApp({ role: "manager" });
    const res = await app.request(
      `/quotes/${quote.id}/share`,
      { method: "POST" },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.token).toBe("already-has-a-token");
  });

  it("returns 404 for a quote that doesn't exist", async () => {
    const app = buildApp({ role: "manager" });
    const res = await app.request(`/quotes/does-not-exist/share`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});
