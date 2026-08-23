import { pgTable, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentsTable = pgTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("valid"),
  expiryDate: date("expiry_date", { mode: "string" }),
  issuedDate: date("issued_date", { mode: "string" }),
  relatedTo: text("related_to").notNull().default("company"),
  relatedId: text("related_id"),
  relatedName: text("related_name"),
  notes: text("notes"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  createdAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
