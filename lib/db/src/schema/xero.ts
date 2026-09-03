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
  // Default Xero chart-of-accounts codes applied to line items when pushing
  // sales documents (invoices/quotes) and purchase bills. Nullable - when
  // unset, Xero falls back to its own default account for the org.
  salesAccountCode: text("sales_account_code"),
  purchasesAccountCode: text("purchases_account_code"),
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

// ─── Suppliers (subcontractors pushed as Xero supplier contacts) ────────────

export const xeroSupplierMapTable = sqliteTable("xero_supplier_map", {
  subcontractorId: text("subcontractor_id").primaryKey(),
  xeroContactId: text("xero_contact_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Bills (purchase orders pushed as Xero ACCPAY invoices) ─────────────────

export const xeroBillMapTable = sqliteTable("xero_bill_map", {
  purchaseOrderId: text("purchase_order_id").primaryKey(),
  xeroBillId: text("xero_bill_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Credit notes (credited invoices pushed as Xero ACCRECCREDIT notes) ─────

export const xeroCreditNoteMapTable = sqliteTable("xero_credit_note_map", {
  invoiceId: text("invoice_id").primaryKey(),
  xeroCreditNoteId: text("xero_credit_note_id").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Sync activity log ───────────────────────────────────────────────────────

export const xeroSyncLogTable = sqliteTable("xero_sync_log", {
  id: text("id").primaryKey(),
  direction: text("direction").notNull(), // "push" | "pull"
  resource: text("resource").notNull(), // "contacts" | "invoices" | "quotes" | "suppliers" | "bills" | "credit_notes" | "payments"
  succeeded: integer("succeeded").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  detail: text("detail"), // short human-readable summary, e.g. an error message
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type XeroSyncLogRow = typeof xeroSyncLogTable.$inferSelect;
