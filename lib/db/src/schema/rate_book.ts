import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rateBookTable = pgTable("rate_book", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  labourRate: real("labour_rate").notNull().default(0),
  materialRate: real("material_rate").notNull().default(0),
  plantRate: real("plant_rate").notNull().default(0),
  totalRate: real("total_rate").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertRateBookEntrySchema = createInsertSchema(rateBookTable).omit(
  { createdAt: true },
);
export type InsertRateBookEntry = z.infer<typeof insertRateBookEntrySchema>;
export type RateBookEntry = typeof rateBookTable.$inferSelect;
