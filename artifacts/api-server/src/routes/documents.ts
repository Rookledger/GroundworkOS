import { Hono } from "hono";
import { documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { CreateDocumentInput, UpdateDocumentInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

function computeDocStatus(expiryDate?: string | null): string {
  if (!expiryDate) return "valid";
  const expiry = new Date(expiryDate);
  const now = new Date();
  if (expiry < now) return "expired";
  const daysUntil = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil <= 30) return "expiring_soon";
  return "valid";
}

router.get("/documents", requireRole("manager"), async (c) => {
  const docs = await c
    .get("db")
    .select()
    .from(documentsTable)
    .orderBy(documentsTable.createdAt);
  return c.json(docs);
});

router.post("/documents", requireRole("manager"), async (c) => {
  const parsed = CreateDocumentInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const data = parsed.data;
  const id = generateId();
  const status = computeDocStatus(data.expiryDate);
  const [doc] = await db
    .insert(documentsTable)
    .values({ id, ...data, status })
    .returning();
  await logAudit(c, "document", id, "create", {
    name: data.name,
    type: data.type,
  });
  return c.json(doc, 201);
});

router.patch("/documents/:id", requireRole("manager"), async (c) => {
  const parsed = UpdateDocumentInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.expiryDate !== undefined) {
    updates.status = computeDocStatus(parsed.data.expiryDate);
  }
  const [doc] = await db
    .update(documentsTable)
    .set(updates)
    .where(eq(documentsTable.id, id))
    .returning();
  if (!doc) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "document", id, "update", updates);
  return c.json(doc);
});

router.delete("/documents/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "document", id, "delete", null);
  await db.delete(documentsTable).where(eq(documentsTable.id, id));
  return c.body(null, 204);
});

export default router;
