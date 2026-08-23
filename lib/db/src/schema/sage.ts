import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sageConnectionTable = pgTable("sage_connection", {
  id: text("id")
    .primaryKey()
    .$default(() => "singleton"),
  businessId: text("business_id").notNull(),
  businessName: text("business_name"),
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

export const sageClientMapTable = pgTable("sage_client_map", {
  clientId: text("client_id").primaryKey(),
  sageContactId: text("sage_contact_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sageInvoiceMapTable = pgTable("sage_invoice_map", {
  invoiceId: text("invoice_id").primaryKey(),
  sageInvoiceId: text("sage_invoice_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sageQuoteMapTable = pgTable("sage_quote_map", {
  quoteId: text("quote_id").primaryKey(),
  sageQuoteId: text("sage_quote_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
