import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

// SQLite has no native date type or date_trunc(); strftime('%Y-%m', ...)
// truncates an ISO date/text column to a "YYYY-MM" period string, which is
// the SQLite-native equivalent of Postgres's date_trunc('month', ...). The
// `s.active = true` / boolean comparison from the original Postgres query
// becomes `s.active = 1`, since SQLite stores booleans as 0/1 integers.
router.get("/cis/returns", requireRole("manager"), async (c) => {
  try {
    const rows = await c.get("db").all(sql`
      SELECT
        strftime('%Y-%m', i.issued_date) AS period,
        s.company_name,
        s.utr_number,
        s.cis_status,
        s.cis_deduction_rate,
        coalesce(sum(i.total_amount), 0) AS gross_payment,
        coalesce(sum(i.cis_deduction), 0) AS cis_deducted,
        coalesce(sum(i.total_amount), 0) - coalesce(sum(i.cis_deduction), 0) AS net_payment,
        count(i.id) AS invoice_count
      FROM subcontractors s
      LEFT JOIN invoices i ON i.subcontractor_id = s.id AND i.status = 'paid'
      WHERE s.active = 1
      GROUP BY strftime('%Y-%m', i.issued_date), s.id, s.company_name, s.utr_number, s.cis_status, s.cis_deduction_rate
      ORDER BY period DESC, s.company_name
    `);
    return c.json(rows);
  } catch (err) {
    c.get("logger").error({ err }, "CIS returns query failed");
    return c.json({ error: "Failed to load CIS returns" }, 500);
  }
});

export default router;
