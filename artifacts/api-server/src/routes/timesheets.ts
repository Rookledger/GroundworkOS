import { Hono } from "hono";
import { timesheetsTable, jobsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateTimesheetInput, UpdateTimesheetInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.get("/timesheets", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(timesheetsTable)
    .orderBy(desc(timesheetsTable.workDate), desc(timesheetsTable.createdAt));
  const jobIds = [
    ...new Set(rows.map((r) => r.jobId).filter(Boolean)),
  ] as string[];
  const jobs = jobIds.length
    ? await db
        .select({
          id: jobsTable.id,
          jobNumber: jobsTable.jobNumber,
          title: jobsTable.title,
        })
        .from(jobsTable)
    : [];
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  return c.json(
    rows.map((r) => ({
      ...r,
      jobNumber: r.jobId ? (jobMap.get(r.jobId)?.jobNumber ?? null) : null,
      jobTitle: r.jobId ? (jobMap.get(r.jobId)?.title ?? null) : null,
    })),
  );
});

router.post("/timesheets", async (c) => {
  const parsed = CreateTimesheetInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const data = parsed.data;
  const id = generateId();
  const hoursWorked = Number(data.hoursWorked ?? 8);
  const dayRate = data.dayRate ? Number(data.dayRate) : null;
  const cost =
    dayRate != null ? Math.round((hoursWorked / 8) * dayRate * 100) / 100 : null;
  const [row] = await db
    .insert(timesheetsTable)
    .values({ id, ...data, hoursWorked, dayRate, cost })
    .returning();
  await logAudit(c, "timesheet", id, "create", {
    jobId: data.jobId,
    workDate: data.workDate,
  });
  return c.json({ ...row, jobNumber: null, jobTitle: null }, 201);
});

router.patch("/timesheets/:id", async (c) => {
  const parsed = UpdateTimesheetInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const data = parsed.data;
  const hoursWorked =
    data.hoursWorked != null ? Number(data.hoursWorked) : undefined;
  const dayRate = data.dayRate != null ? Number(data.dayRate) : undefined;
  const updates: Record<string, unknown> = { ...data };
  if (hoursWorked !== undefined) updates.hoursWorked = hoursWorked;
  if (dayRate !== undefined) updates.dayRate = dayRate;
  if (updates.hoursWorked !== undefined || updates.dayRate !== undefined) {
    const [existing] = await db
      .select()
      .from(timesheetsTable)
      .where(eq(timesheetsTable.id, id));
    const h = (updates.hoursWorked as number | undefined) ?? existing?.hoursWorked ?? 8;
    const d = (updates.dayRate as number | null | undefined) ?? existing?.dayRate ?? null;
    updates.cost = d != null ? Math.round((h / 8) * d * 100) / 100 : null;
  }
  const [row] = await db
    .update(timesheetsTable)
    .set(updates)
    .where(eq(timesheetsTable.id, id))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "timesheet", id, "update", updates);
  return c.json({ ...row, jobNumber: null, jobTitle: null });
});

router.delete("/timesheets/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "timesheet", id, "delete", null);
  await db.delete(timesheetsTable).where(eq(timesheetsTable.id, id));
  return c.body(null, 204);
});

export default router;
