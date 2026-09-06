import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A RAMS (Risk Assessment & Method Statement) record, built in-app rather
 * than tracked only as an uploaded PDF (see documents.ts, which still
 * handles the filed copy and its expiry). `hazards` and `attendees` are
 * stored as JSON text - D1/SQLite has no native array/JSON column type -
 * and are parsed/stringified at the API boundary (see routes/rams.ts).
 *
 * `attendees` doubles as the toolbox-talk sign-off register for this RAMS:
 * each entry is a site worker acknowledging they were briefed on it, not a
 * separate record, since a RAMS without a briefing record is the actual
 * compliance gap this fills.
 */
export const ramsTable = sqliteTable("rams_records", {
  id: text("id").primaryKey(),
  jobId: text("job_id"),
  title: text("title").notNull(),
  activity: text("activity").notNull(),
  riskLevel: text("risk_level").notNull().default("medium"),
  status: text("status").notNull().default("draft"),
  // JSON array of { hazard, whoAtRisk, controls, riskBefore, riskAfter }
  hazards: text("hazards").notNull().default("[]"),
  // JSON array of PPE item strings
  ppe: text("ppe").notNull().default("[]"),
  briefedAt: integer("briefed_at", { mode: "timestamp_ms" }),
  briefedBy: text("briefed_by"),
  // JSON array of { name, role, acknowledged, acknowledgedAt }
  attendees: text("attendees").notNull().default("[]"),
  reviewDate: text("review_date"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertRamsSchema = createInsertSchema(ramsTable).omit({
  createdAt: true,
});
export type InsertRams = z.infer<typeof insertRamsSchema>;
export type RamsRecord = typeof ramsTable.$inferSelect;
