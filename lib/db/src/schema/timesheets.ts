import { pgTable, text, date, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timesheetsTable = pgTable("timesheets", {
  id: text("id").primaryKey(),
  jobId: text("job_id"),
  workerName: text("worker_name").notNull(),
  workDate: date("work_date", { mode: "string" }).notNull(),
  hoursWorked: real("hours_worked").notNull().default(8),
  dayRate: real("day_rate"),
  cost: real("cost"),
  description: text("description"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTimesheetSchema = createInsertSchema(timesheetsTable).omit({
  createdAt: true,
});
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type TimesheetRow = typeof timesheetsTable.$inferSelect;
