import { pgTable, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const idCountersTable = pgTable("id_counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

export const insertIdCounterSchema = createInsertSchema(idCountersTable);
export type InsertIdCounter = z.infer<typeof insertIdCounterSchema>;
export type IdCounter = typeof idCountersTable.$inferSelect;
