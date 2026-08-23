import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";

const router = Router();

router.get("/cis/returns", requireRole("manager"), async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        date_trunc('month', i.issued_date::date) AS period,
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
      WHERE s.active = true
      GROUP BY date_trunc('month', i.issued_date::date), s.id, s.company_name, s.utr_number, s.cis_status, s.cis_deduction_rate
      ORDER BY period DESC, s.company_name
    `);
    res.json((rows as any).rows ?? rows);
  } catch (err) {
    console.error("CIS returns query failed:", err);
    res.status(500).json({ error: "Failed to load CIS returns" });
  }
});

export default router;
