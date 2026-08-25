import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const freeagentConnectionTable = sqliteTable("freeagent_connection", {
  id: text("id")
    .primaryKey()
    .$default(() => "singleton"),
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

export const freeagentClientMapTable = sqliteTable("freeagent_client_map", {
  clientId: text("client_id").primaryKey(),
  freeagentContactId: text("freeagent_contact_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const freeagentInvoiceMapTable = sqliteTable("freeagent_invoice_map", {
  invoiceId: text("invoice_id").primaryKey(),
  freeagentInvoiceId: text("freeagent_invoice_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const freeagentQuoteMapTable = sqliteTable("freeagent_quote_map", {
  quoteId: text("quote_id").primaryKey(),
  freeagentEstimateId: text("freeagent_estimate_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
