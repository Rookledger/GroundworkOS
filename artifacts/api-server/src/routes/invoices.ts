import { Router } from "express";
import {
  db,
  invoicesTable,
  clientsTable,
  jobsTable,
  subcontractorsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateInvoiceInput, UpdateInvoiceInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { requireRole } from "../lib/auth.js";

const router = Router();

const VAT_RATE = 0.2;

async function enrichInvoice(inv: typeof invoicesTable.$inferSelect) {
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
async function computeFinancials(data: Record<string, any>) {
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

router.get("/invoices", requireRole("manager"), async (req, res) => {
  const invoices = await db
    .select()
    .from(invoicesTable)
    .orderBy(invoicesTable.createdAt);
  const enriched = await Promise.all(invoices.map(enrichInvoice));
  res.json(enriched);
});

router.post("/invoices", requireRole("manager"), async (req, res) => {
  const parsed = CreateInvoiceInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  // `vatAmount`/`totalAmount`/`cisDeduction` are recomputed below rather than
  // trusted from the request; the input schema never accepts them.
  const data = await computeFinancials(parsed.data);
  const { generateId, nextSeqNumber } = await import("../lib/generateId.js");
  const id = generateId();
  const invoiceNumber = await nextSeqNumber("invoices", "INV");
  // `data` is a loosely-typed Record from computeFinancials; cast once here
  // rather than threading strict types through the whole compute pipeline.
  const insertData = {
    id,
    invoiceNumber,
    ...data,
  } as typeof invoicesTable.$inferInsert;
  const [inv] = await db.insert(invoicesTable).values(insertData).returning();
  await logAudit(
    "invoice",
    id,
    "create",
    { invoiceNumber, status: insertData.status },
    req,
  );
  return res.status(201).json(await enrichInvoice(inv));
});

router.get("/invoices/:id", requireRole("manager"), async (req, res) => {
  const [inv] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, req.params.id));
  if (!inv) return res.status(404).json({ error: "Not found" });
  return res.json(await enrichInvoice(inv));
});

router.patch("/invoices/:id", requireRole("manager"), async (req, res) => {
  const parsed = UpdateInvoiceInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const rest = parsed.data;
  let data: Record<string, any> = rest;
  // Only recompute VAT/total/CIS if something that affects them changed;
  // otherwise this is a partial update (e.g. just `status`) and we leave the
  // existing financial fields untouched.
  if (rest.subtotal !== undefined || rest.subcontractorId !== undefined) {
    const [existing] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    data = await computeFinancials({
      subtotal: rest.subtotal ?? existing.subtotal,
      subcontractorId:
        rest.subcontractorId !== undefined
          ? rest.subcontractorId
          : existing.subcontractorId,
      ...rest,
    });
  }
  const [inv] = await db
    .update(invoicesTable)
    .set(data)
    .where(eq(invoicesTable.id, req.params.id))
    .returning();
  if (!inv) return res.status(404).json({ error: "Not found" });
  await logAudit("invoice", req.params.id, "update", data, req);
  return res.json(await enrichInvoice(inv));
});

router.delete("/invoices/:id", requireRole("manager"), async (req, res) => {
  await logAudit("invoice", req.params.id, "delete", null, req);
  await db.delete(invoicesTable).where(eq(invoicesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
