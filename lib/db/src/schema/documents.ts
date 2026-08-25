import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentsTable = sqliteTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("valid"),
  expiryDate: text("expiry_date"),
  issuedDate: text("issued_date"),
  relatedTo: text("related_to").notNull().default("company"),
  relatedId: text("related_id"),
  relatedName: text("related_name"),
  notes: text("notes"),
  filePath: text("file_path"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  createdAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
