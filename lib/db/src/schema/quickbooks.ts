import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const quickbooksConnectionTable = sqliteTable("quickbooks_connection", {
  id: text("id")
    .primaryKey()
    .$default(() => "singleton"),
  realmId: text("realm_id").notNull(),
  companyName: text("company_name"),
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

export const quickbooksClientMapTable = sqliteTable("quickbooks_client_map", {
  clientId: text("client_id").primaryKey(),
  quickbooksCustomerId: text("quickbooks_customer_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const quickbooksInvoiceMapTable = sqliteTable(
  "quickbooks_invoice_map",
  {
    invoiceId: text("invoice_id").primaryKey(),
    quickbooksInvoiceId: text("quickbooks_invoice_id").notNull(),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
);

export const quickbooksQuoteMapTable = sqliteTable("quickbooks_quote_map", {
  quoteId: text("quote_id").primaryKey(),
  quickbooksEstimateId: text("quickbooks_estimate_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
