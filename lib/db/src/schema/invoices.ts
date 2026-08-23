import { pgTable, text, real, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
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
  issuedDate: date("issued_date", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  cisDeduction: real("cis_deduction"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  createdAt: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
