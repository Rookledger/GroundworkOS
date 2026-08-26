import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const auditLogsTable = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  changes: text("changes", { mode: "json" }).$type<Record<
    string,
    unknown
  > | null>(),
  userId: text("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
