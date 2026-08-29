import { Hono } from "hono";
import type { Database } from "@workspace/db";
import {
  invoicesTable,
  clientsTable,
  jobsTable,
  subcontractorsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateInvoiceInput, UpdateInvoiceInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { requireRole } from "../lib/auth.js";
import { generateId, nextSeqNumber } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

const VAT_RATE = 0.2;

async function enrichInvoice(db: Database, inv: typeof invoicesTable.$inferSelect) {
  const [client] = inv.clientId
    ? await db
        .select({ companyName: clientsTable.companyName })
        .from(clientsTable)
        .where(eq(clientsTable.id, inv.clientId))
    : [null];
  const [job] = inv.jobId
    ? await db
        .select({ title: jobsTable.title })
        .from(jobsTable)
        .where(eq(jobsTable.id, inv.jobId))
    : [null];
  return {
    ...inv,
    clientName: client?.companyName ?? null,
    jobTitle: job?.title ?? null,
  };
}

/**
 * Recompute financial fields server-side instead of trusting client-sent
 * values. `subtotal` is treated as the source of truth (frontend has no
 * per-line-item editor for invoices yet); VAT and total are always derived
 * from it. If the invoice is linked to a subcontractor, the CIS deduction is
 * derived from that subcontractor's on-file deduction rate rather than any
 * client-supplied value.
 */
async function computeFinancials(db: Database, data: Record<string, any>) {
  const subtotal = Math.round((Number(data.subtotal) || 0) * 100) / 100;
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
  const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;

  let cisDeduction: number | null = null;
  if (data.subcontractorId) {
    const [sub] = await db
      .select({ cisDeductionRate: subcontractorsTable.cisDeductionRate })
      .from(subcontractorsTable)
      .where(eq(subcontractorsTable.id, data.subcontractorId));
    if (sub) {
      cisDeduction =
        Math.round(subtotal * (sub.cisDeductionRate / 100) * 100) / 100;
    }
  }

  return { ...data, subtotal, vatAmount, totalAmount, cisDeduction };
}

router.get("/invoices", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const invoices = await db
    .select()
    .from(invoicesTable)
    .orderBy(invoicesTable.createdAt);
  const enriched = await Promise.all(invoices.map((inv) => enrichInvoice(db, inv)));
  return c.json(enriched);
});

router.post("/invoices", requireRole("manager"), async (c) => {
  const parsed = CreateInvoiceInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  // `vatAmount`/`totalAmount`/`cisDeduction` are recomputed below rather than
  // trusted from the request; the input schema never accepts them.
  const data = await computeFinancials(db, parsed.data);
  const id = generateId();
  const invoiceNumber = await nextSeqNumber(db, "invoices", "INV");
  // `data` is a loosely-typed Record from computeFinancials; cast once here
  // rather than threading strict types through the whole compute pipeline.
  const insertData = {
    id,
    invoiceNumber,
    ...data,
  } as typeof invoicesTable.$inferInsert;
  const [inv] = await db.insert(invoicesTable).values(insertData).returning();
  await logAudit(c, "invoice", id, "create", {
    invoiceNumber,
    status: insertData.status,
  });
  return c.json(await enrichInvoice(db, inv), 201);
});

router.get("/invoices/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) return c.json({ error: "Not found" }, 404);
  return c.json(await enrichInvoice(db, inv));
});

router.patch("/invoices/:id", requireRole("manager"), async (c) => {
  const parsed = UpdateInvoiceInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const { paidAt, ...rest } = parsed.data;
  // `paidAt` is a `timestamp_ms`-mode Drizzle column, so it must be converted
  // to a Date before being written (a raw ISO string throws at the DB layer),
  // mirroring how routes/quotes.ts handles `sentAt`.
  let data: Record<string, any> = {
    ...rest,
    ...(paidAt !== undefined && { paidAt: new Date(paidAt) }),
  };
  // Only recompute VAT/total/CIS if something that affects them changed;
  // otherwise this is a partial update (e.g. just `status`) and we leave the
  // existing financial fields untouched.
  if (rest.subtotal !== undefined || rest.subcontractorId !== undefined) {
    const [existing] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id));
    if (!existing) return c.json({ error: "Not found" }, 404);
    data = await computeFinancials(db, {
      subtotal: rest.subtotal ?? existing.subtotal,
      subcontractorId:
        rest.subcontractorId !== undefined
          ? rest.subcontractorId
          : existing.subcontractorId,
      ...rest,
      ...(paidAt !== undefined && { paidAt: new Date(paidAt) }),
    });
  }
  const [inv] = await db
    .update(invoicesTable)
    .set(data)
    .where(eq(invoicesTable.id, id))
    .returning();
  if (!inv) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "invoice", id, "update", data);
  return c.json(await enrichInvoice(db, inv));
});

router.delete("/invoices/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "invoice", id, "delete", null);
  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  return c.body(null, 204);
});

export default router;
