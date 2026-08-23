import { Router } from "express";
import { db, clientsTable, jobsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateClientInput, UpdateClientInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { requireRole } from "../lib/auth.js";

const router = Router();

router.get("/clients", requireRole("manager"), async (req, res) => {
  const clients = await db
    .select()
    .from(clientsTable)
    .orderBy(clientsTable.companyName);
  const jobStats = await db
    .select({
      clientId: jobsTable.clientId,
      totalJobs: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(${jobsTable.value}), 0)`,
    })
    .from(jobsTable)
    .groupBy(jobsTable.clientId);
  const statsMap = new Map(jobStats.map((s) => [s.clientId, s]));
  const result = clients.map((c) => ({
    ...c,
    totalJobs: statsMap.get(c.id)?.totalJobs ?? 0,
    totalValue: statsMap.get(c.id)?.totalValue ?? 0,
  }));
  res.json(result);
});

router.post("/clients", requireRole("manager"), async (req, res) => {
  const parsed = CreateClientInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const { generateId } = await import("../lib/generateId.js");
  const id = generateId();
  const [client] = await db
    .insert(clientsTable)
    .values({ id, ...data })
    .returning();
  await logAudit(
    "client",
    id,
    "create",
    { companyName: data.companyName },
    req,
  );
  return res.status(201).json({ ...client, totalJobs: 0, totalValue: 0 });
});

router.get("/clients/:id", requireRole("manager"), async (req, res) => {
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, req.params.id));
  if (!client) return res.status(404).json({ error: "Not found" });
  const [stats] = await db
    .select({
      totalJobs: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(${jobsTable.value}), 0)`,
    })
    .from(jobsTable)
    .where(eq(jobsTable.clientId, req.params.id));
  return res.json({
    ...client,
    totalJobs: stats?.totalJobs ?? 0,
    totalValue: stats?.totalValue ?? 0,
  });
});

router.patch("/clients/:id", requireRole("manager"), async (req, res) => {
  const parsed = UpdateClientInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const [client] = await db
    .update(clientsTable)
    .set(data)
    .where(eq(clientsTable.id, req.params.id))
    .returning();
  if (!client) return res.status(404).json({ error: "Not found" });
  await logAudit("client", req.params.id, "update", data, req);
  return res.json({ ...client, totalJobs: 0, totalValue: 0 });
});

router.delete("/clients/:id", requireRole("manager"), async (req, res) => {
  await logAudit("client", req.params.id, "delete", null, req);
  await db.delete(clientsTable).where(eq(clientsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
