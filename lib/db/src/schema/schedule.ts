import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scheduleEntriesTable = pgTable("schedule_entries", {
  id: text("id").primaryKey(),
  jobId: text("job_id"),
  title: text("title").notNull(),
  startDatetime: timestamp("start_datetime", { withTimezone: true }).notNull(),
  endDatetime: timestamp("end_datetime", { withTimezone: true }).notNull(),
  crewCount: integer("crew_count").notNull().default(1),
  plantAssigned: text("plant_assigned"),
  foreman: text("foreman"),
  notes: text("notes"),
  type: text("type").notNull().default("site_work"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertScheduleEntrySchema = createInsertSchema(
  scheduleEntriesTable,
).omit({ createdAt: true });
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
export type ScheduleEntry = typeof scheduleEntriesTable.$inferSelect;
