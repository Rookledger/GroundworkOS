import { Hono } from "hono";
import { ramsTable, jobsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import {
  CreateRamsRecordInput,
  UpdateRamsRecordInput,
  AcknowledgeRamsInput,
} from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

type Attendee = {
  name: string;
  role?: string;
  subcontractorId?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
};

/**
 * `hazards`, `ppe` and `attendees` are stored as JSON text (see
 * lib/db/src/schema/rams.ts - D1/SQLite has no array/JSON column type).
 * This turns a raw row from the DB into the shape the API actually
 * returns/accepts: parsed arrays, with a computed jobTitle join for display
 * since the frontend list view needs it and a client-side join per row
 * would mean fetching every job just to label a RAMS record.
 */
function serializeRams(
  row: typeof ramsTable.$inferSelect,
  jobTitle?: string | null,
) {
  return {
    ...row,
    jobTitle: jobTitle ?? null,
    hazards: JSON.parse(row.hazards || "[]"),
    ppe: JSON.parse(row.ppe || "[]"),
    attendees: JSON.parse(row.attendees || "[]") as Attendee[],
  };
}

router.get("/rams", requireRole("foreman"), async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({ rams: ramsTable, jobTitle: jobsTable.title })
    .from(ramsTable)
    .leftJoin(jobsTable, eq(ramsTable.jobId, jobsTable.id))
    .orderBy(desc(ramsTable.createdAt));
  return c.json(rows.map(({ rams, jobTitle }) => serializeRams(rams, jobTitle)));
});

router.get("/rams/:id", requireRole("foreman"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db
    .select({ rams: ramsTable, jobTitle: jobsTable.title })
    .from(ramsTable)
    .leftJoin(jobsTable, eq(ramsTable.jobId, jobsTable.id))
    .where(eq(ramsTable.id, id));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(serializeRams(row.rams, row.jobTitle));
});

router.post("/rams", requireRole("manager"), async (c) => {
  const parsed = CreateRamsRecordInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const { hazards, ppe, attendees, ...rest } = parsed.data;
  const id = generateId();
  const [row] = await db
    .insert(ramsTable)
    .values({
      id,
      ...rest,
      hazards: JSON.stringify(hazards ?? []),
      ppe: JSON.stringify(ppe ?? []),
      attendees: JSON.stringify(
        (attendees ?? []).map((a) => ({ ...a, acknowledged: false })),
      ),
    })
    .returning();
  await logAudit(c, "rams", id, "create", {
    title: rest.title,
    activity: rest.activity,
  });
  return c.json(serializeRams(row), 201);
});

router.patch("/rams/:id", requireRole("manager"), async (c) => {
  const parsed = UpdateRamsRecordInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const { hazards, ppe, attendees, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (hazards !== undefined) updates.hazards = JSON.stringify(hazards);
  if (ppe !== undefined) updates.ppe = JSON.stringify(ppe);
  if (attendees !== undefined) {
    updates.attendees = JSON.stringify(
      attendees.map((a) => ({ ...a, acknowledged: false })),
    );
  }
  const [row] = await db
    .update(ramsTable)
    .set(updates)
    .where(eq(ramsTable.id, id))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "rams", id, "update", updates);
  return c.json(serializeRams(row));
});

/**
 * Toolbox-talk sign-off: a site worker (or the foreman entering it for them
 * on a shared device) confirming they were briefed on this RAMS. Deliberately
 * its own endpoint rather than a PATCH field - see AcknowledgeRamsInput in
 * @workspace/api-zod - so acknowledging a briefing can never also rewrite
 * the method statement, and so the server stamps the time rather than
 * trusting a client-supplied one.
 */
router.post("/rams/:id/acknowledge", requireRole("foreman"), async (c) => {
  const parsed = AcknowledgeRamsInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(ramsTable)
    .where(eq(ramsTable.id, id));
  if (!existing) return c.json({ error: "Not found" }, 404);

  const attendees = JSON.parse(existing.attendees || "[]") as Attendee[];
  const now = new Date().toISOString();
  const { name, role, subcontractorId } = parsed.data;
  const idx = attendees.findIndex((a) => a.name === name);
  if (idx >= 0) {
    attendees[idx] = { ...attendees[idx], acknowledged: true, acknowledgedAt: now };
  } else {
    attendees.push({ name, role, subcontractorId, acknowledged: true, acknowledgedAt: now });
  }

  const briefedUpdate: Record<string, unknown> = {
    attendees: JSON.stringify(attendees),
  };
  if (!existing.briefedAt) {
    briefedUpdate.briefedAt = new Date();
    briefedUpdate.briefedBy = name;
  }

  const [row] = await db
    .update(ramsTable)
    .set(briefedUpdate)
    .where(eq(ramsTable.id, id))
    .returning();
  await logAudit(c, "rams", id, "acknowledge", { name });
  return c.json(serializeRams(row));
});

router.delete("/rams/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "rams", id, "delete", null);
  await db.delete(ramsTable).where(eq(ramsTable.id, id));
  return c.body(null, 204);
});

export default router;
