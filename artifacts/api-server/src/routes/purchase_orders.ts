import { Router } from "express";
import { db, purchaseOrdersTable, jobsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from "@workspace/api-zod";
import { logAudit } from "./audit.js";

const router = Router();

async function withJob(row: typeof purchaseOrdersTable.$inferSelect) {
  if (!row.jobId) return { ...row, jobNumber: null, jobTitle: null };
  const [job] = await db
    .select({ jobNumber: jobsTable.jobNumber, title: jobsTable.title })
    .from(jobsTable)
    .where(eq(jobsTable.id, row.jobId));
  return {
    ...row,
    jobNumber: job?.jobNumber ?? null,
    jobTitle: job?.title ?? null,
  };
}

router.get("/purchase-orders", requireRole("manager"), async (req, res) => {
  const rows = await db
    .select()
    .from(purchaseOrdersTable)
    .orderBy(
      desc(purchaseOrdersTable.orderDate),
      desc(purchaseOrdersTable.createdAt),
    );
  const jobIds = [
    ...new Set(rows.map((r) => r.jobId).filter(Boolean)),
  ] as string[];
  const jobs = jobIds.length
    ? await db
        .select({
          id: jobsTable.id,
          jobNumber: jobsTable.jobNumber,
          title: jobsTable.title,
        })
        .from(jobsTable)
    : [];
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  res.json(
    rows.map((r) => ({
      ...r,
      jobNumber: r.jobId ? (jobMap.get(r.jobId)?.jobNumber ?? null) : null,
      jobTitle: r.jobId ? (jobMap.get(r.jobId)?.title ?? null) : null,
    })),
  );
});

router.post("/purchase-orders", requireRole("manager"), async (req, res) => {
  const parsed = CreatePurchaseOrderInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const { generateId, nextSeqNumber } = await import("../lib/generateId.js");
  const id = generateId();
  const poNumber = await nextSeqNumber("purchase_orders", "PO");
  const amount = Number(data.amount ?? 0);
  const vatAmount = Number(
    data.vatAmount ?? Math.round(amount * 0.2 * 100) / 100,
  );
  const totalAmount = Number(data.totalAmount ?? amount + vatAmount);
  const [row] = await db
    .insert(purchaseOrdersTable)
    .values({ id, poNumber, ...data, amount, vatAmount, totalAmount })
    .returning();
  await logAudit(
    "purchase_order",
    id,
    "create",
    { poNumber, supplier: data.supplier },
    req,
  );
  return res.status(201).json(await withJob(row));
});

router.patch(
  "/purchase-orders/:id",
  requireRole("manager"),
  async (req, res) => {
    const parsed = UpdatePurchaseOrderInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }
    const data: Record<string, unknown> = { ...parsed.data };
    if (
      parsed.data.amount !== undefined ||
      parsed.data.vatAmount !== undefined
    ) {
      const amount = Number(parsed.data.amount ?? 0);
      const vatAmount = Number(
        parsed.data.vatAmount ?? Math.round(amount * 0.2 * 100) / 100,
      );
      data.amount = amount;
      data.vatAmount = vatAmount;
      data.totalAmount = amount + vatAmount;
    }
    const [row] = await db
      .update(purchaseOrdersTable)
      .set(data)
      .where(eq(purchaseOrdersTable.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    await logAudit("purchase_order", req.params.id, "update", data, req);
    return res.json(await withJob(row));
  },
);

router.delete(
  "/purchase-orders/:id",
  requireRole("manager"),
  async (req, res) => {
    await logAudit("purchase_order", req.params.id, "delete", null, req);
    await db
      .delete(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, req.params.id));
    res.status(204).send();
  },
);

export default router;
