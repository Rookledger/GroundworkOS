import { Hono } from "hono";
import type { Database } from "@workspace/db";
import { scheduleEntriesTable, jobsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { CreateScheduleInput, UpdateScheduleInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

async function enrichEntry(
  db: Database,
  entry: typeof scheduleEntriesTable.$inferSelect,
) {
  const [job] = entry.jobId
    ? await db
        .select({
          jobNumber: jobsTable.jobNumber,
          title: jobsTable.title,
          clientId: jobsTable.clientId,
        })
        .from(jobsTable)
        .where(eq(jobsTable.id, entry.jobId))
    : [null];
  const [client] = job?.clientId
    ? await db
        .select({ companyName: clientsTable.companyName })
        .from(clientsTable)
        .where(eq(clientsTable.id, job.clientId))
    : [null];
  return {
    ...entry,
    startDatetime:
      entry.startDatetime instanceof Date
        ? entry.startDatetime.toISOString()
        : entry.startDatetime,
    endDatetime:
      entry.endDatetime instanceof Date
        ? entry.endDatetime.toISOString()
        : entry.endDatetime,
    jobNumber: job?.jobNumber ?? null,
    jobTitle: job?.title ?? null,
    clientName: client?.companyName ?? null,
  };
}

router.get("/schedule", requireRole("foreman"), async (c) => {
  const db = c.get("db");
  const entries = await db
    .select()
    .from(scheduleEntriesTable)
    .orderBy(scheduleEntriesTable.startDatetime);
  const enriched = await Promise.all(
    entries.map((entry) => enrichEntry(db, entry)),
  );
  return c.json(enriched);
});

router.post("/schedule", requireRole("foreman"), async (c) => {
  const parsed = CreateScheduleInput.safeParse(await c.req.json());
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
    .insert(scheduleEntriesTable)
    .values({
      id,
      ...data,
      startDatetime: new Date(data.startDatetime),
      endDatetime: new Date(data.endDatetime),
    })
    .returning();
  await logAudit(c, "schedule_entry", id, "create", {
    jobId: data.jobId,
    title: data.title,
  });
  return c.json(await enrichEntry(db, entry), 201);
});

router.patch("/schedule/:id", requireRole("foreman"), async (c) => {
  const parsed = UpdateScheduleInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const { startDatetime, endDatetime, ...data } = parsed.data;
  const [entry] = await db
    .update(scheduleEntriesTable)
    .set({
      ...data,
      ...(startDatetime !== undefined && {
        startDatetime: new Date(startDatetime),
      }),
      ...(endDatetime !== undefined && { endDatetime: new Date(endDatetime) }),
    })
    .where(eq(scheduleEntriesTable.id, id))
    .returning();
  if (!entry) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "schedule_entry", id, "update", parsed.data);
  return c.json(await enrichEntry(db, entry));
});

router.delete("/schedule/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "schedule_entry", id, "delete", null);
  await db.delete(scheduleEntriesTable).where(eq(scheduleEntriesTable.id, id));
  return c.body(null, 204);
});

export default router;
