import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scheduleEntriesTable = sqliteTable("schedule_entries", {
  id: text("id").primaryKey(),
  jobId: text("job_id"),
  title: text("title").notNull(),
  startDatetime: integer("start_datetime", {
    mode: "timestamp_ms",
  }).notNull(),
  endDatetime: integer("end_datetime", { mode: "timestamp_ms" }).notNull(),
  crewCount: integer("crew_count").notNull().default(1),
  plantAssigned: text("plant_assigned"),
  foreman: text("foreman"),
  notes: text("notes"),
  type: text("type").notNull().default("site_work"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertScheduleEntrySchema = createInsertSchema(
  scheduleEntriesTable,
).omit({ createdAt: true });
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
export type ScheduleEntry = typeof scheduleEntriesTable.$inferSelect;
