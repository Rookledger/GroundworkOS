import { Router } from "express";
import { db, rateBookTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { CreateRateBookInput, UpdateRateBookInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";

const router = Router();

router.get("/rate-book", requireRole("manager"), async (req, res) => {
  const entries = await db
    .select()
    .from(rateBookTable)
    .orderBy(rateBookTable.category, rateBookTable.description);
  res.json(entries);
});

router.post("/rate-book", requireRole("manager"), async (req, res) => {
  const parsed = CreateRateBookInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const { generateId } = await import("../lib/generateId.js");
  const id = generateId();
  const [entry] = await db
    .insert(rateBookTable)
    .values({ id, ...data })
    .returning();
  await logAudit(
    "rate_book",
    entry.id,
    "create",
    { description: entry.description },
    req,
  );
  return res.status(201).json(entry);
});

router.patch("/rate-book/:id", requireRole("manager"), async (req, res) => {
  const parsed = UpdateRateBookInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const [entry] = await db
    .update(rateBookTable)
    .set(data)
    .where(eq(rateBookTable.id, req.params.id))
    .returning();
  if (!entry) return res.status(404).json({ error: "Not found" });
  await logAudit("rate_book", req.params.id, "update", data, req);
  return res.json(entry);
});

router.delete("/rate-book/:id", requireRole("manager"), async (req, res) => {
  await logAudit("rate_book", req.params.id, "delete", null, req);
  await db.delete(rateBookTable).where(eq(rateBookTable.id, req.params.id));
  res.status(204).send();
});

export default router;
