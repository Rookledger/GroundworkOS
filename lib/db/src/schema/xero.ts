import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const xeroConnectionTable = sqliteTable("xero_connection", {
  id: text("id")
    .primaryKey()
    .$default(() => "singleton"),
  tenantId: text("tenant_id").notNull(),
  tenantName: text("tenant_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  connectedAt: integer("connected_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const xeroClientMapTable = sqliteTable("xero_client_map", {
  clientId: text("client_id").primaryKey(),
  xeroContactId: text("xero_contact_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const xeroInvoiceMapTable = sqliteTable("xero_invoice_map", {
  invoiceId: text("invoice_id").primaryKey(),
  xeroInvoiceId: text("xero_invoice_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const xeroQuoteMapTable = sqliteTable("xero_quote_map", {
  quoteId: text("quote_id").primaryKey(),
  xeroQuoteId: text("xero_quote_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
