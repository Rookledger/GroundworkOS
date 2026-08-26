import { Hono } from "hono";
import type { Database } from "@workspace/db";
import { quotesTable, lineItemsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateQuoteInput, UpdateQuoteInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { requireRole } from "../lib/auth.js";
import { generateId, nextSeqNumber } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

const VAT_RATE = 0.2;

async function enrichQuote(db: Database, quote: typeof quotesTable.$inferSelect) {
  const lineItems = await db
    .select()
    .from(lineItemsTable)
    .where(eq(lineItemsTable.quoteId, quote.id));
  const [client] = quote.clientId
    ? await db
        .select({ companyName: clientsTable.companyName })
        .from(clientsTable)
        .where(eq(clientsTable.id, quote.clientId))
    : [null];
  return { ...quote, lineItems, clientName: client?.companyName ?? null };
}

/** Recompute subtotal/VAT/total server-side from line items — never trust client totals. */
function computeTotalsFromLineItems(
  lineItems: Array<{ quantity?: number; unitPrice?: number; total?: number }>,
) {
  const subtotal =
    Math.round(
      lineItems.reduce(
        (sum, li) =>
          sum + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0),
        0,
      ) * 100,
    ) / 100;
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
  const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;
  return { subtotal, vatAmount, totalAmount };
}

router.get("/quotes", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const quotes = await db.select().from(quotesTable).orderBy(quotesTable.createdAt);
  const enriched = await Promise.all(quotes.map((q) => enrichQuote(db, q)));
  return c.json(enriched);
});

router.post("/quotes", requireRole("manager"), async (c) => {
  const parsed = CreateQuoteInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const { lineItems, ...data } = parsed.data;
  const totals = lineItems?.length
    ? computeTotalsFromLineItems(lineItems)
    : { subtotal: 0, vatAmount: 0, totalAmount: 0 };
  const id = generateId();

  // D1's Drizzle driver doesn't support interactive transactions
  // (db.transaction(async (tx) => ...)) the way the old node-postgres driver
  // did - there's no way to hold a connection open across an await while
  // running application logic in between. The sequence-number allocation is
  // already atomic on its own (a single INSERT ... ON CONFLICT ... RETURNING
  // statement - see nextSeqNumber), so it runs first as its own statement;
  // the only thing that genuinely needs to happen atomically together is the
  // quote row and its line items, which db.batch() runs as a single D1
  // implicit transaction (all-or-nothing, no partial write visible to
  // another request) since neither statement depends on a result from the
  // other - the id is generated client-side up front.
  const quoteNumber = await nextSeqNumber(db, "quotes", "QT");
  const lineItemRows = (lineItems ?? []).map((li) => ({
    ...li,
    id: generateId(),
    quoteId: id,
    total:
      Math.round((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0) * 100) /
      100,
  }));

  const insertQuote = db
    .insert(quotesTable)
    .values({ id, quoteNumber, ...data, ...totals })
    .returning();

  const [[quote]] = lineItemRows.length
    ? await db.batch([insertQuote, db.insert(lineItemsTable).values(lineItemRows)])
    : [await insertQuote];

  await logAudit(c, "quote", id, "create", {
    quoteNumber: quote.quoteNumber,
    status: data.status,
  });
  return c.json(await enrichQuote(db, quote), 201);
});

router.get("/quotes/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
  if (!quote) return c.json({ error: "Not found" }, 404);
  return c.json(await enrichQuote(db, quote));
});

router.patch("/quotes/:id", requireRole("manager"), async (c) => {
  const parsed = UpdateQuoteInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const { lineItems, sentAt, ...data } = parsed.data;
  const totals =
    lineItems !== undefined
      ? lineItems.length
        ? computeTotalsFromLineItems(lineItems)
        : { subtotal: 0, vatAmount: 0, totalAmount: 0 }
      : {};

  const updateQuote = db
    .update(quotesTable)
    .set({
      ...data,
      ...totals,
      ...(sentAt !== undefined && { sentAt: new Date(sentAt) }),
    })
    .where(eq(quotesTable.id, id))
    .returning();

  let quote: typeof quotesTable.$inferSelect | undefined;
  if (lineItems !== undefined) {
    const lineItemRows = lineItems.map((li) => ({
      ...li,
      id: generateId(),
      quoteId: id,
      total:
        Math.round(
          (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0) * 100,
        ) / 100,
    }));
    // Same batching rationale as POST above: the update and the line-item
    // replace (delete + optional re-insert) need to land together, and none
    // of the statements depend on another statement's result, so they can
    // all run in one atomic db.batch() call instead of an interactive
    // transaction.
    const statements = [
      updateQuote,
      db.delete(lineItemsTable).where(eq(lineItemsTable.quoteId, id)),
      ...(lineItemRows.length
        ? [db.insert(lineItemsTable).values(lineItemRows)]
        : []),
    ] as const;
    const [updated] = await db.batch(statements as any);
    quote = (updated as (typeof quotesTable.$inferSelect)[])[0];
  } else {
    [quote] = await updateQuote;
  }
  if (!quote) return c.json({ error: "Not found" }, 404);

  await logAudit(c, "quote", id, "update", data);
  return c.json(await enrichQuote(db, quote));
});

router.delete("/quotes/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "quote", id, "delete", null);
  await db.batch([
    db.delete(lineItemsTable).where(eq(lineItemsTable.quoteId, id)),
    db.delete(quotesTable).where(eq(quotesTable.id, id)),
  ]);
  return c.body(null, 204);
});

export default router;
