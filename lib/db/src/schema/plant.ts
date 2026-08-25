import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plantTable = sqliteTable("plant", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  registration: text("registration"),
  category: text("category").notNull(),
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  status: text("status").notNull().default("available"),
  currentJobId: text("current_job_id"),
  serviceDue: text("service_due"),
  motDue: text("mot_due"),
  thoroughExamDue: text("thorough_exam_due"),
  notes: text("notes"),
  dailyRate: real("daily_rate"),
  owned: integer("owned", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertPlantSchema = createInsertSchema(plantTable).omit({
  createdAt: true,
});
export type InsertPlant = z.infer<typeof insertPlantSchema>;
export type Plant = typeof plantTable.$inferSelect;
