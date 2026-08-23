import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const freeagentConnectionTable = pgTable("freeagent_connection", {
  id: text("id")
    .primaryKey()
    .$default(() => "singleton"),
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

export const freeagentClientMapTable = pgTable("freeagent_client_map", {
  clientId: text("client_id").primaryKey(),
  freeagentContactId: text("freeagent_contact_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const freeagentInvoiceMapTable = pgTable("freeagent_invoice_map", {
  invoiceId: text("invoice_id").primaryKey(),
  freeagentInvoiceId: text("freeagent_invoice_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const freeagentQuoteMapTable = pgTable("freeagent_quote_map", {
  quoteId: text("quote_id").primaryKey(),
  freeagentEstimateId: text("freeagent_estimate_id").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
