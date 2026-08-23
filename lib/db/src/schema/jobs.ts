import {
  pgTable,
  text,
  integer,
  boolean,
  date,
  timestamp,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey(),
  jobNumber: text("job_number").notNull().unique(),
  title: text("title").notNull(),
  clientId: text("client_id"),
  type: text("type"),
  siteAddress: text("site_address"),
  value: real("value"),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  status: text("status").notNull().default("enquiry"),
  progressPercent: integer("progress_percent").notNull().default(0),
  description: text("description"),
  foreman: text("foreman"),
  crewCount: integer("crew_count"),
  nrswaRequired: boolean("nrswa_required").notNull().default(false),
  permitNumber: text("permit_number"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  createdAt: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
