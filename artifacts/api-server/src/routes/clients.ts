import { Hono } from "hono";
import { clientsTable, jobsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateClientInput, UpdateClientInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { requireRole } from "../lib/auth.js";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.get("/clients", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const clients = await db
    .select()
    .from(clientsTable)
    .orderBy(clientsTable.companyName);
  const jobStats = await db
    .select({
      clientId: jobsTable.clientId,
      totalJobs: sql<number>`count(*)`,
      totalValue: sql<number>`coalesce(sum(${jobsTable.value}), 0)`,
    })
    .from(jobsTable)
    .groupBy(jobsTable.clientId);
  const statsMap = new Map(jobStats.map((s) => [s.clientId, s]));
  const result = clients.map((cl) => ({
    ...cl,
    totalJobs: statsMap.get(cl.id)?.totalJobs ?? 0,
    totalValue: statsMap.get(cl.id)?.totalValue ?? 0,
  }));
  return c.json(result);
});

router.post("/clients", requireRole("manager"), async (c) => {
  const parsed = CreateClientInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const data = parsed.data;
  const id = generateId();
  const [client] = await db
    .insert(clientsTable)
    .values({ id, ...data })
    .returning();
  await logAudit(c, "client", id, "create", { companyName: data.companyName });
  return c.json({ ...client, totalJobs: 0, totalValue: 0 }, 201);
});

router.get("/clients/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, id));
  if (!client) return c.json({ error: "Not found" }, 404);
  const [stats] = await db
    .select({
      totalJobs: sql<number>`count(*)`,
      totalValue: sql<number>`coalesce(sum(${jobsTable.value}), 0)`,
    })
    .from(jobsTable)
    .where(eq(jobsTable.clientId, id));
  return c.json({
    ...client,
    totalJobs: stats?.totalJobs ?? 0,
    totalValue: stats?.totalValue ?? 0,
  });
});

router.patch("/clients/:id", requireRole("manager"), async (c) => {
  const parsed = UpdateClientInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const data = parsed.data;
  const [client] = await db
    .update(clientsTable)
    .set(data)
    .where(eq(clientsTable.id, id))
    .returning();
  if (!client) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "client", id, "update", data);
  return c.json({ ...client, totalJobs: 0, totalValue: 0 });
});

router.delete("/clients/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "client", id, "delete", null);
  await db.delete(clientsTable).where(eq(clientsTable.id, id));
  return c.body(null, 204);
});

export default router;
