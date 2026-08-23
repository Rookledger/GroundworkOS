import { Router } from "express";
import {
  db,
  quotesTable,
  lineItemsTable,
  clientsTable,
  companySettingsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireRole } from "../lib/auth.js";
import { logAudit } from "./audit.js";

const router = Router();

async function getQuoteByToken(token: string) {
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
  const settings = (settingsRow?.data ?? {}) as Record<string, any>;
  return { quote, lineItems, client, settings };
}

router.get("/portal/:token", async (req, res) => {
  const data = await getQuoteByToken(req.params.token);
  if (!data)
    return res.status(404).json({ error: "Quote not found or link expired" });
  const { quote, lineItems, client, settings } = data;
  return res.json({
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

router.post("/portal/:token/approve", async (req, res) => {
  const { name } = req.body;
  if (!name?.trim())
    return res.status(400).json({ error: "Name is required to approve" });
  const data = await getQuoteByToken(req.params.token);
  if (!data)
    return res.status(404).json({ error: "Quote not found or link expired" });
  if (data.quote.status === "accepted")
    return res.status(409).json({ error: "Already accepted" });
  await db
    .update(quotesTable)
    .set({
      status: "accepted",
      approvedByName: name.trim(),
      approvedAt: new Date(),
    })
    .where(eq(quotesTable.shareToken, req.params.token));
  await logAudit(
    "quote",
    data.quote.id,
    "portal_accept",
    { approvedByName: name.trim() },
    req,
  );
  return res.json({ ok: true, message: "Quote accepted" });
});

router.post("/portal/:token/decline", async (req, res) => {
  const data = await getQuoteByToken(req.params.token);
  if (!data)
    return res.status(404).json({ error: "Quote not found or link expired" });
  if (data.quote.status === "accepted")
    return res.status(409).json({ error: "Quote already accepted" });
  await db
    .update(quotesTable)
    .set({ status: "declined" })
    .where(eq(quotesTable.shareToken, req.params.token));
  await logAudit("quote", data.quote.id, "portal_decline", null, req);
  return res.json({ ok: true, message: "Quote declined" });
});

router.post("/quotes/:id/share", requireRole("manager"), async (req, res) => {
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.id, req.params.id));
  if (!quote) return res.status(404).json({ error: "Not found" });
  let token = quote.shareToken;
  if (!token) {
    token = randomUUID();
    await db
      .update(quotesTable)
      .set({ shareToken: token })
      .where(eq(quotesTable.id, req.params.id));
  }
  const baseUrl =
    process.env.APP_URL ?? req.headers.origin ?? "https://example.com";
  const url = `${baseUrl}/portal/${token}`;
  return res.json({ token, url });
});

export default router;
