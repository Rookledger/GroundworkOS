import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: text("client_id"),
  jobId: text("job_id"),
  quoteId: text("quote_id"),
  subcontractorId: text("subcontractor_id"),
  subtotal: real("subtotal").notNull().default(0),
  vatAmount: real("vat_amount").notNull().default(0),
  totalAmount: real("total_amount").notNull().default(0),
  status: text("status").notNull().default("draft"),
  issuedDate: text("issued_date").notNull(),
  dueDate: text("due_date"),
  paidAt: integer("paid_at", { mode: "timestamp_ms" }),
  notes: text("notes"),
  cisDeduction: real("cis_deduction"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  createdAt: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
