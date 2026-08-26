import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchaseOrdersTable = sqliteTable("purchase_orders", {
  id: text("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  jobId: text("job_id"),
  supplier: text("supplier").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull().default(0),
  vatAmount: real("vat_amount").notNull().default(0),
  totalAmount: real("total_amount").notNull().default(0),
  status: text("status").notNull().default("draft"),
  orderDate: text("order_date").notNull(),
  expectedDelivery: text("expected_delivery"),
  deliveryDate: text("delivery_date"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertPurchaseOrderSchema = createInsertSchema(
  purchaseOrdersTable,
).omit({ createdAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderRow = typeof purchaseOrdersTable.$inferSelect;
