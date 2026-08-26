import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { CompanySettingsInput } from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { adminExists } from "./admin.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

// GET is intentionally open to any authenticated user (not manager-gated):
// the onboarding-wizard check in App.tsx reads this for every role,
// including foreman, before any role-gated UI has loaded.
router.get("/settings/company", async (c) => {
  try {
    const row = await c.get("db").get<{ data: unknown }>(sql`
      SELECT data FROM company_settings WHERE id = 1
    `);
    return c.json(row?.data ?? {});
  } catch (err) {
    c.get("logger").error({ err }, "Failed to load company settings");
    return c.json({ error: "Failed to load company settings" }, 500);
  }
});

// PUT is normally manager+, but a brand-new deployment has no manager/admin
// yet, so — mirroring the admin bootstrap flow — we also allow it for a
// foreman while no admin exists, so the very first user can complete the
// onboarding wizard and set up the company.
router.put("/settings/company", async (c, next) => {
  if (!(await adminExists(c))) return next();
  return requireRole("manager")(c, next);
});

router.put("/settings/company", async (c) => {
  const parsed = CompanySettingsInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const data = parsed.data;
  try {
    const json = JSON.stringify(data);
    await c.get("db").run(sql`
      INSERT INTO company_settings (id, data, updated_at)
      VALUES (1, ${json}, unixepoch('now') * 1000)
      ON CONFLICT (id) DO UPDATE SET data = ${json}, updated_at = unixepoch('now') * 1000
    `);
    await logAudit(c, "settings", "company", "update", data);
    return c.json({ ok: true });
  } catch (err) {
    c.get("logger").error({ err }, "Failed to save company settings");
    return c.json({ error: "Failed to save company settings" }, 500);
  }
});

export default router;
