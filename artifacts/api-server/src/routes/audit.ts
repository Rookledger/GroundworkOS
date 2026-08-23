import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { desc, eq, and, gte } from "drizzle-orm";
import { generateId } from "../lib/generateId.js";
import { requireRole } from "../lib/auth.js";
import type { Request } from "express";

const router = Router();

export async function logAudit(
  entityType: string,
  entityId: string,
  action: "create" | "update" | "delete" | (string & {}),
  changes: Record<string, any> | null,
  req: Request,
) {
  try {
    const auth = (req as any).auth;
    const userId = auth?.userId ?? null;
    const userName =
      auth?.sessionClaims?.fullName ?? auth?.sessionClaims?.name ?? null;
    const userEmail = auth?.sessionClaims?.email ?? null;
    await db.insert(auditLogsTable).values({
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

router.get("/audit-logs", requireRole("admin"), async (req, res) => {
  const {
    entityType,
    entityId,
    days = "30",
    limit = "100",
  } = req.query as Record<string, string>;
  const since = new Date(Date.now() - Number(days) * 86400000);

  const conditions = [gte(auditLogsTable.createdAt, since)];
  if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));
  if (entityId) conditions.push(eq(auditLogsTable.entityId, entityId));

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(and(...conditions))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(Math.min(Number(limit), 500));

  res.json(logs);
});

export default router;
