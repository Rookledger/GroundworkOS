import { Hono } from "hono";
import type { Context } from "hono";
import { getAuth } from "@hono/clerk-auth";
import { auditLogsTable } from "@workspace/db";
import { desc, eq, and, gte } from "drizzle-orm";
import { generateId } from "../lib/generateId.js";
import { requireRole } from "../lib/auth.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

export async function logAudit(
  c: Context<AppEnv>,
  entityType: string,
  entityId: string,
  action: "create" | "update" | "delete" | (string & {}),
  changes: Record<string, unknown> | null,
) {
  try {
    const auth = getAuth(c);
    const userId = auth?.userId ?? null;
    const claims = auth?.sessionClaims as
      | { fullName?: string; name?: string; email?: string }
      | undefined;
    const userName = claims?.fullName ?? claims?.name ?? null;
    const userEmail = claims?.email ?? null;
    await c.get("db").insert(auditLogsTable).values({
      id: generateId(),
      entityType,
      entityId,
      action,
      changes,
      userId,
      userName,
      userEmail,
    });
  } catch {
    // audit log failures must never crash the main request
  }
}

router.get("/audit-logs", requireRole("admin"), async (c) => {
  const db = c.get("db");
  const entityType = c.req.query("entityType");
  const entityId = c.req.query("entityId");
  const days = Number(c.req.query("days") ?? "30");
  const limit = Number(c.req.query("limit") ?? "100");
  const since = new Date(Date.now() - days * 86400000);

  const conditions = [gte(auditLogsTable.createdAt, since)];
  if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));
  if (entityId) conditions.push(eq(auditLogsTable.entityId, entityId));

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(and(...conditions))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(Math.min(limit, 500));

  return c.json(logs);
});

export default router;
