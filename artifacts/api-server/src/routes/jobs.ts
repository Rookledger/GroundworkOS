import { Hono } from "hono";
import { jobsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateJobInput, UpdateJobInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { requireRole } from "../lib/auth.js";
import { generateId, nextSeqNumber } from "../lib/generateId.js";
import type { AppEnv } from "../types";
import type { Database } from "@workspace/db";

const router = new Hono<AppEnv>();

async function withClient(db: Database, job: typeof jobsTable.$inferSelect) {
  const [client] = job.clientId
    ? await db
        .select({ companyName: clientsTable.companyName })
        .from(clientsTable)
        .where(eq(clientsTable.id, job.clientId))
    : [null];
  return { ...job, clientName: client?.companyName ?? null };
}

router.get("/jobs", requireRole("foreman"), async (c) => {
  const db = c.get("db");
  const jobs = await db.select().from(jobsTable).orderBy(jobsTable.createdAt);
  const clientIds = [
    ...new Set(jobs.map((j) => j.clientId).filter(Boolean)),
  ] as string[];
  const clients = clientIds.length
    ? await db
        .select({ id: clientsTable.id, companyName: clientsTable.companyName })
        .from(clientsTable)
    : [];
  const clientMap = new Map(clients.map((cl) => [cl.id, cl.companyName]));
  return c.json(
    jobs.map((j) => ({
      ...j,
      clientName: clientMap.get(j.clientId ?? "") ?? null,
    })),
  );
});

router.post("/jobs", requireRole("foreman"), async (c) => {
  const parsed = CreateJobInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const data = parsed.data;
  const id = generateId();
  const jobNumber = await nextSeqNumber(db, "jobs", "GW");
  const [job] = await db
    .insert(jobsTable)
    .values({ id, jobNumber, ...data })
    .returning();
  await logAudit(c, "job", id, "create", {
    title: data.title,
    status: data.status,
  });
  return c.json(await withClient(db, job), 201);
});

router.get("/jobs/:id", requireRole("foreman"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) return c.json({ error: "Not found" }, 404);
  return c.json(await withClient(db, job));
});

router.patch("/jobs/:id", requireRole("foreman"), async (c) => {
  const parsed = UpdateJobInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const data = parsed.data;
  const [job] = await db
    .update(jobsTable)
    .set(data)
    .where(eq(jobsTable.id, id))
    .returning();
  if (!job) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "job", id, "update", data);
  return c.json(await withClient(db, job));
});

router.delete("/jobs/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "job", id, "delete", null);
  await db.delete(jobsTable).where(eq(jobsTable.id, id));
  return c.body(null, 204);
});

export default router;
