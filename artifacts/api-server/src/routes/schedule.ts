import { Router } from "express";
import {
  db,
  scheduleEntriesTable,
  jobsTable,
  clientsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { CreateScheduleInput, UpdateScheduleInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";

const router = Router();

async function enrichEntry(entry: typeof scheduleEntriesTable.$inferSelect) {
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

router.get("/schedule", requireRole("foreman"), async (req, res) => {
  const entries = await db
    .select()
    .from(scheduleEntriesTable)
    .orderBy(scheduleEntriesTable.startDatetime);
  const enriched = await Promise.all(entries.map(enrichEntry));
  res.json(enriched);
});

router.post("/schedule", requireRole("foreman"), async (req, res) => {
  const parsed = CreateScheduleInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const { generateId } = await import("../lib/generateId.js");
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
  await logAudit(
    "schedule_entry",
    id,
    "create",
    { jobId: data.jobId, title: data.title },
    req,
  );
  return res.status(201).json(await enrichEntry(entry));
});

router.patch("/schedule/:id", requireRole("foreman"), async (req, res) => {
  const parsed = UpdateScheduleInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
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
    .where(eq(scheduleEntriesTable.id, req.params.id))
    .returning();
  if (!entry) return res.status(404).json({ error: "Not found" });
  await logAudit("schedule_entry", req.params.id, "update", parsed.data, req);
  return res.json(await enrichEntry(entry));
});

router.delete("/schedule/:id", requireRole("manager"), async (req, res) => {
  await logAudit("schedule_entry", req.params.id, "delete", null, req);
  await db
    .delete(scheduleEntriesTable)
    .where(eq(scheduleEntriesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
