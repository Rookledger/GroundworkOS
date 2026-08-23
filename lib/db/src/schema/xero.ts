import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const xeroConnectionTable = pgTable("xero_connection", {
  id: text("id")
    .primaryKey()
    .$default(() => "singleton"),
  tenantId: text("tenant_id").notNull(),
  tenantName: text("tenant_name"),
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

export const xeroClientMapTable = pgTable("xero_client_map", {
  clientId: text("client_id").primaryKey(),
  xeroContactId: text("xero_contact_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const xeroInvoiceMapTable = pgTable("xero_invoice_map", {
  invoiceId: text("invoice_id").primaryKey(),
  xeroInvoiceId: text("xero_invoice_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const xeroQuoteMapTable = pgTable("xero_quote_map", {
  quoteId: text("quote_id").primaryKey(),
  xeroQuoteId: text("xero_quote_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
