import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const companySettingsTable = sqliteTable("company_settings", {
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>()
    .$defaultFn(() => ({})),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
