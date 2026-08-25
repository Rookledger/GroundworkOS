import { Hono } from "hono";
import type { Database } from "@workspace/db";
import { plantTable, jobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { CreatePlantInput, UpdatePlantInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

async function enrichPlant(
  db: Database,
  item: typeof plantTable.$inferSelect,
) {
  const [job] = item.currentJobId
    ? await db
        .select({ title: jobsTable.title })
        .from(jobsTable)
        .where(eq(jobsTable.id, item.currentJobId))
    : [null];
  return { ...item, currentJobTitle: job?.title ?? null };
}

router.get("/plant", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const items = await db.select().from(plantTable).orderBy(plantTable.name);
  const enriched = await Promise.all(items.map((item) => enrichPlant(db, item)));
  return c.json(enriched);
});

router.post("/plant", requireRole("manager"), async (c) => {
  const parsed = CreatePlantInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const data = parsed.data;
  const id = generateId();
  const [item] = await db
    .insert(plantTable)
    .values({ id, ...data })
    .returning();
  await logAudit(c, "plant", id, "create", { name: data.name });
  return c.json(await enrichPlant(db, item), 201);
});

router.patch("/plant/:id", requireRole("manager"), async (c) => {
  const parsed = UpdatePlantInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const data = parsed.data;
  const [item] = await db
    .update(plantTable)
    .set(data)
    .where(eq(plantTable.id, id))
    .returning();
  if (!item) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "plant", id, "update", data);
  return c.json(await enrichPlant(db, item));
});

router.delete("/plant/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "plant", id, "delete", null);
  await db.delete(plantTable).where(eq(plantTable.id, id));
  return c.body(null, 204);
});

export default router;
