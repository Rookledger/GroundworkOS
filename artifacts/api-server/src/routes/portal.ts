import { Hono } from "hono";
import {
  quotesTable,
  lineItemsTable,
  clientsTable,
  companySettingsTable,
} from "@workspace/db";
import type { Database } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { logAudit } from "./audit.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

async function getQuoteByToken(db: Database, token: string) {
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.shareToken, token));
  if (!quote) return null;
  const lineItems = await db
    .select()
    .from(lineItemsTable)
    .where(eq(lineItemsTable.quoteId, quote.id));
  const [client] = quote.clientId
    ? await db
        .select({
          companyName: clientsTable.companyName,
          email: clientsTable.email,
          address: clientsTable.address,
        })
        .from(clientsTable)
        .where(eq(clientsTable.id, quote.clientId))
    : [null];
  const [settingsRow] = await db
    .select()
    .from(companySettingsTable)
    .where(eq(companySettingsTable.id, 1));
  const settings = (settingsRow?.data ?? {}) as Record<string, unknown>;
  return { quote, lineItems, client, settings };
}

router.get("/portal/:token", async (c) => {
  const data = await getQuoteByToken(c.get("db"), c.req.param("token"));
  if (!data) return c.json({ error: "Quote not found or link expired" }, 404);
  const { quote, lineItems, client, settings } = data;
  return c.json({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    status: quote.status,
    subtotal: quote.subtotal,
    vatAmount: quote.vatAmount,
    totalAmount: quote.totalAmount,
    validUntil: quote.validUntil,
    notes: quote.notes,
    approvedByName: quote.approvedByName,
    approvedAt: quote.approvedAt,
    lineItems,
    client,
    company: {
      name: settings.companyName ?? "GroundworkOS",
      address: settings.address ?? "",
      vatNumber: settings.vatNumber ?? "",
      phone: settings.phone ?? "",
      email: settings.email ?? "",
    },
  });
});

router.post("/portal/:token/approve", async (c) => {
  const { name } = await c.req.json();
  if (!name?.trim()) {
    return c.json({ error: "Name is required to approve" }, 400);
  }
  const db = c.get("db");
  const token = c.req.param("token");
  const data = await getQuoteByToken(db, token);
  if (!data) return c.json({ error: "Quote not found or link expired" }, 404);
  if (data.quote.status === "accepted") {
    return c.json({ error: "Already accepted" }, 409);
  }
  await db
    .update(quotesTable)
    .set({
      status: "accepted",
      approvedByName: name.trim(),
      approvedAt: new Date(),
    })
    .where(eq(quotesTable.shareToken, token));
  await logAudit(c, "quote", data.quote.id, "portal_accept", {
    approvedByName: name.trim(),
  });
  return c.json({ ok: true, message: "Quote accepted" });
});

router.post("/portal/:token/decline", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  const data = await getQuoteByToken(db, token);
  if (!data) return c.json({ error: "Quote not found or link expired" }, 404);
  if (data.quote.status === "accepted") {
    return c.json({ error: "Quote already accepted" }, 409);
  }
  await db
    .update(quotesTable)
    .set({ status: "declined" })
    .where(eq(quotesTable.shareToken, token));
  await logAudit(c, "quote", data.quote.id, "portal_decline", null);
  return c.json({ ok: true, message: "Quote declined" });
});

router.post("/quotes/:id/share", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
  if (!quote) return c.json({ error: "Not found" }, 404);
  let token = quote.shareToken;
  if (!token) {
    token = crypto.randomUUID();
    await db
      .update(quotesTable)
      .set({ shareToken: token })
      .where(eq(quotesTable.id, id));
  }
  const baseUrl =
    c.env.APP_URL || c.req.header("origin") || "https://example.com";
  const url = `${baseUrl}/portal/${token}`;
  return c.json({ token, url });
});

export default router;
