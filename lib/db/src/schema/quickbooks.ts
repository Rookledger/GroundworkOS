import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const quickbooksConnectionTable = pgTable("quickbooks_connection", {
  id: text("id")
    .primaryKey()
    .$default(() => "singleton"),
  realmId: text("realm_id").notNull(),
  companyName: text("company_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const quickbooksClientMapTable = pgTable("quickbooks_client_map", {
  clientId: text("client_id").primaryKey(),
  quickbooksCustomerId: text("quickbooks_customer_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const quickbooksInvoiceMapTable = pgTable("quickbooks_invoice_map", {
  invoiceId: text("invoice_id").primaryKey(),
  quickbooksInvoiceId: text("quickbooks_invoice_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const quickbooksQuoteMapTable = pgTable("quickbooks_quote_map", {
  quoteId: text("quote_id").primaryKey(),
  quickbooksEstimateId: text("quickbooks_estimate_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
