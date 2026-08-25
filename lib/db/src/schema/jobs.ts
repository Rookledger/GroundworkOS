import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  jobNumber: text("job_number").notNull().unique(),
  title: text("title").notNull(),
  clientId: text("client_id"),
  type: text("type"),
  siteAddress: text("site_address"),
  value: real("value"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").notNull().default("enquiry"),
  progressPercent: integer("progress_percent").notNull().default(0),
  description: text("description"),
  foreman: text("foreman"),
  crewCount: integer("crew_count"),
  nrswaRequired: integer("nrswa_required", { mode: "boolean" })
    .notNull()
    .default(false),
  permitNumber: text("permit_number"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  createdAt: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
