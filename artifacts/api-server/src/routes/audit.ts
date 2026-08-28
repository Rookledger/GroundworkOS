import { Hono } from "hono";
import type { Context } from "hono";
import { auditLogsTable, userTable } from "@workspace/db";
import { desc, eq, and, gte } from "drizzle-orm";
import { generateId } from "../lib/generateId.js";
import { requireRole } from "../lib/auth.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

/**
 * Best-effort attribution for the audit trail. `userId` comes straight off
 * the context (set by app.ts's session middleware); name/email are looked
 * up from the same D1 `user` row the session itself resolved to, rather
 * than from session claims (Better Auth's session object doesn't carry a
 * denormalized display name/email the way Clerk's `sessionClaims` did).
 * Never throws - audit log failures must never crash the main request.
 */
export async function logAudit(
  c: Context<AppEnv>,
  entityType: string,
  entityId: string,
  action: "create" | "update" | "delete" | (string & {}),
  changes: Record<string, unknown> | null,
) {
  try {
    const userId = c.get("userId") ?? null;
    let userName: string | null = null;
    let userEmail: string | null = null;
    if (userId) {
      const [user] = await c
        .get("db")
        .select({ name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      userName = user?.name ?? null;
      userEmail = user?.email ?? null;
    }
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
