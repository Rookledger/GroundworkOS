import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const sageConnectionTable = sqliteTable("sage_connection", {
  id: text("id")
    .primaryKey()
    .$default(() => "singleton"),
  businessId: text("business_id").notNull(),
  businessName: text("business_name"),
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

export const sageClientMapTable = sqliteTable("sage_client_map", {
  clientId: text("client_id").primaryKey(),
  sageContactId: text("sage_contact_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sageInvoiceMapTable = sqliteTable("sage_invoice_map", {
  invoiceId: text("invoice_id").primaryKey(),
  sageInvoiceId: text("sage_invoice_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sageQuoteMapTable = sqliteTable("sage_quote_map", {
  quoteId: text("quote_id").primaryKey(),
  sageQuoteId: text("sage_quote_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
