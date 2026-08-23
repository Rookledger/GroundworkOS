import { pgTable, text, date, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: text("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  jobId: text("job_id"),
  supplier: text("supplier").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull().default(0),
  vatAmount: real("vat_amount").notNull().default(0),
  totalAmount: real("total_amount").notNull().default(0),
  status: text("status").notNull().default("draft"),
  orderDate: date("order_date", { mode: "string" }).notNull(),
  expectedDelivery: date("expected_delivery", { mode: "string" }),
  deliveryDate: date("delivery_date", { mode: "string" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPurchaseOrderSchema = createInsertSchema(
  purchaseOrdersTable,
).omit({ createdAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderRow = typeof purchaseOrdersTable.$inferSelect;
