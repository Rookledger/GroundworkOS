import { pgTable, text, real, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotesTable = pgTable("quotes", {
  id: text("id").primaryKey(),
  quoteNumber: text("quote_number").notNull().unique(),
  clientId: text("client_id"),
  jobId: text("job_id"),
  title: text("title"),
  status: text("status").notNull().default("draft"),
  subtotal: real("subtotal").notNull().default(0),
  vatAmount: real("vat_amount").notNull().default(0),
  totalAmount: real("total_amount").notNull().default(0),
  validUntil: date("valid_until", { mode: "string" }),
  notes: text("notes"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  shareToken: text("share_token").unique(),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const lineItemsTable = pgTable("line_items", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull(),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(0),
  unit: text("unit").notNull().default("No"),
  unitPrice: real("unit_price").notNull().default(0),
  total: real("total").notNull().default(0),
});

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({
  createdAt: true,
});
export const insertLineItemSchema = createInsertSchema(lineItemsTable);
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type InsertLineItem = z.infer<typeof insertLineItemSchema>;
export type Quote = typeof quotesTable.$inferSelect;
export type LineItem = typeof lineItemsTable.$inferSelect;
