import { pgTable, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const companySettingsTable = pgTable("company_settings", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
