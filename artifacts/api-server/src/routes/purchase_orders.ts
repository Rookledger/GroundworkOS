import { Hono } from "hono";
import type { Database } from "@workspace/db";
import { purchaseOrdersTable, jobsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { generateId, nextSeqNumber } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

async function withJob(
  db: Database,
  row: typeof purchaseOrdersTable.$inferSelect,
) {
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

router.get("/purchase-orders", requireRole("manager"), async (c) => {
  const db = c.get("db");
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
  return c.json(
    rows.map((r) => ({
      ...r,
      jobNumber: r.jobId ? (jobMap.get(r.jobId)?.jobNumber ?? null) : null,
      jobTitle: r.jobId ? (jobMap.get(r.jobId)?.title ?? null) : null,
    })),
  );
});

router.post("/purchase-orders", requireRole("manager"), async (c) => {
  const parsed = CreatePurchaseOrderInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const data = parsed.data;
  const id = generateId();
  const poNumber = await nextSeqNumber(db, "purchase_orders", "PO");
  const amount = Number(data.amount ?? 0);
  const vatAmount = Number(
    data.vatAmount ?? Math.round(amount * 0.2 * 100) / 100,
  );
  const totalAmount = Number(data.totalAmount ?? amount + vatAmount);
  const [row] = await db
    .insert(purchaseOrdersTable)
    .values({ id, poNumber, ...data, amount, vatAmount, totalAmount })
    .returning();
  await logAudit(c, "purchase_order", id, "create", {
    poNumber,
    supplier: data.supplier,
  });
  return c.json(await withJob(db, row), 201);
});

router.patch("/purchase-orders/:id", requireRole("manager"), async (c) => {
  const parsed = UpdatePurchaseOrderInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
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
    .where(eq(purchaseOrdersTable.id, id))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "purchase_order", id, "update", data);
  return c.json(await withJob(db, row));
});

router.delete("/purchase-orders/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "purchase_order", id, "delete", null);
  await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  return c.body(null, 204);
});

export default router;
