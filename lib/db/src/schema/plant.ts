import {
  pgTable,
  text,
  integer,
  boolean,
  real,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plantTable = pgTable("plant", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  registration: text("registration"),
  category: text("category").notNull(),
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  status: text("status").notNull().default("available"),
  currentJobId: text("current_job_id"),
  serviceDue: date("service_due", { mode: "string" }),
  motDue: date("mot_due", { mode: "string" }),
  thoroughExamDue: date("thorough_exam_due", { mode: "string" }),
  notes: text("notes"),
  dailyRate: real("daily_rate"),
  owned: boolean("owned").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPlantSchema = createInsertSchema(plantTable).omit({
  createdAt: true,
});
export type InsertPlant = z.infer<typeof insertPlantSchema>;
export type Plant = typeof plantTable.$inferSelect;
