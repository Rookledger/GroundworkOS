import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timesheetsTable = sqliteTable("timesheets", {
  id: text("id").primaryKey(),
  jobId: text("job_id"),
  workerName: text("worker_name").notNull(),
  workDate: text("work_date").notNull(),
  hoursWorked: real("hours_worked").notNull().default(8),
  dayRate: real("day_rate"),
  cost: real("cost"),
  description: text("description"),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertTimesheetSchema = createInsertSchema(timesheetsTable).omit({
  createdAt: true,
});
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type TimesheetRow = typeof timesheetsTable.$inferSelect;
