import { Hono } from "hono";
import { rateBookTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { CreateRateBookInput, UpdateRateBookInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.get("/rate-book", requireRole("manager"), async (c) => {
  const entries = await c
    .get("db")
    .select()
    .from(rateBookTable)
    .orderBy(rateBookTable.category, rateBookTable.description);
  return c.json(entries);
});

router.post("/rate-book", requireRole("manager"), async (c) => {
  const parsed = CreateRateBookInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const data = parsed.data;
  const id = generateId();
  const [entry] = await db
    .insert(rateBookTable)
    .values({ id, ...data })
    .returning();
  await logAudit(c, "rate_book", entry.id, "create", {
    description: entry.description,
  });
  return c.json(entry, 201);
});

router.patch("/rate-book/:id", requireRole("manager"), async (c) => {
  const parsed = UpdateRateBookInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const data = parsed.data;
  const [entry] = await db
    .update(rateBookTable)
    .set(data)
    .where(eq(rateBookTable.id, id))
    .returning();
  if (!entry) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "rate_book", id, "update", data);
  return c.json(entry);
});

router.delete("/rate-book/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "rate_book", id, "delete", null);
  await db.delete(rateBookTable).where(eq(rateBookTable.id, id));
  return c.body(null, 204);
});

export default router;
