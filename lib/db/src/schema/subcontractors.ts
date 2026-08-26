import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subcontractorsTable = sqliteTable("subcontractors", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  utrNumber: text("utr_number"),
  cisStatus: text("cis_status").notNull().default("unverified"),
  cisDeductionRate: real("cis_deduction_rate").notNull().default(30),
  trade: text("trade"),
  nrswaCardNumber: text("nrswa_card_number"),
  nrswaExpiry: text("nrswa_expiry"),
  publicLiabilityExpiry: text("public_liability_expiry"),
  cscsCardExpiry: text("cscs_card_expiry"),
  address: text("address"),
  notes: text("notes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const insertSubcontractorSchema = createInsertSchema(
  subcontractorsTable,
).omit({ createdAt: true });
export type InsertSubcontractor = z.infer<typeof insertSubcontractorSchema>;
export type Subcontractor = typeof subcontractorsTable.$inferSelect;
