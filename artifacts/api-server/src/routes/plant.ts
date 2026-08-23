import { Router } from "express";
import { db, plantTable, jobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { CreatePlantInput, UpdatePlantInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";

const router = Router();

async function enrichPlant(item: typeof plantTable.$inferSelect) {
  const [job] = item.currentJobId
    ? await db
        .select({ title: jobsTable.title })
        .from(jobsTable)
        .where(eq(jobsTable.id, item.currentJobId))
    : [null];
  return { ...item, currentJobTitle: job?.title ?? null };
}

router.get("/plant", requireRole("manager"), async (req, res) => {
  const items = await db.select().from(plantTable).orderBy(plantTable.name);
  const enriched = await Promise.all(items.map(enrichPlant));
  res.json(enriched);
});

router.post("/plant", requireRole("manager"), async (req, res) => {
  const parsed = CreatePlantInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const { generateId } = await import("../lib/generateId.js");
  const id = generateId();
  const [item] = await db
    .insert(plantTable)
    .values({ id, ...data })
    .returning();
  await logAudit("plant", id, "create", { name: data.name }, req);
  return res.status(201).json(await enrichPlant(item));
});

router.patch("/plant/:id", requireRole("manager"), async (req, res) => {
  const parsed = UpdatePlantInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const [item] = await db
    .update(plantTable)
    .set(data)
    .where(eq(plantTable.id, req.params.id))
    .returning();
  if (!item) return res.status(404).json({ error: "Not found" });
  await logAudit("plant", req.params.id, "update", data, req);
  return res.json(await enrichPlant(item));
});

router.delete("/plant/:id", requireRole("manager"), async (req, res) => {
  await logAudit("plant", req.params.id, "delete", null, req);
  await db.delete(plantTable).where(eq(plantTable.id, req.params.id));
  res.status(204).send();
});

export default router;
