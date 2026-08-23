import { Router } from "express";
import { db, documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { CreateDocumentInput, UpdateDocumentInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";

const router = Router();

function computeDocStatus(expiryDate?: string | null): string {
  if (!expiryDate) return "valid";
  const expiry = new Date(expiryDate);
  const now = new Date();
  if (expiry < now) return "expired";
  const daysUntil = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil <= 30) return "expiring_soon";
  return "valid";
}

router.get("/documents", requireRole("manager"), async (req, res) => {
  const docs = await db
    .select()
    .from(documentsTable)
    .orderBy(documentsTable.createdAt);
  res.json(docs);
});

router.post("/documents", requireRole("manager"), async (req, res) => {
  const parsed = CreateDocumentInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const { generateId } = await import("../lib/generateId.js");
  const id = generateId();
  const status = computeDocStatus(data.expiryDate);
  const [doc] = await db
    .insert(documentsTable)
    .values({ id, ...data, status })
    .returning();
  await logAudit(
    "document",
    id,
    "create",
    { name: data.name, type: data.type },
    req,
  );
  return res.status(201).json(doc);
});

router.patch("/documents/:id", requireRole("manager"), async (req, res) => {
  const parsed = UpdateDocumentInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.expiryDate !== undefined) {
    updates.status = computeDocStatus(parsed.data.expiryDate);
  }
  const [doc] = await db
    .update(documentsTable)
    .set(updates)
    .where(eq(documentsTable.id, req.params.id))
    .returning();
  if (!doc) return res.status(404).json({ error: "Not found" });
  await logAudit("document", req.params.id, "update", updates, req);
  return res.json(doc);
});

router.delete("/documents/:id", requireRole("manager"), async (req, res) => {
  await logAudit("document", req.params.id, "delete", null, req);
  await db.delete(documentsTable).where(eq(documentsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
