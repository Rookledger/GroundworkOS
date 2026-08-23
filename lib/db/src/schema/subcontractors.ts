import {
  pgTable,
  text,
  real,
  boolean,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subcontractorsTable = pgTable("subcontractors", {
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
  nrswaExpiry: date("nrswa_expiry", { mode: "string" }),
  publicLiabilityExpiry: date("public_liability_expiry", { mode: "string" }),
  cscsCardExpiry: date("cscs_card_expiry", { mode: "string" }),
  address: text("address"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSubcontractorSchema = createInsertSchema(
  subcontractorsTable,
).omit({ createdAt: true });
export type InsertSubcontractor = z.infer<typeof insertSubcontractorSchema>;
export type Subcontractor = typeof subcontractorsTable.$inferSelect;
