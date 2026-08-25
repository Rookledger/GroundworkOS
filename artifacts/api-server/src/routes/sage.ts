import * as sage from "../lib/sage.js";
import { requireRole } from "../lib/auth.js";
import { createAccountingOAuthRouter } from "./accountingOAuthFactory.js";

const router = createAccountingOAuthRouter({
  provider: "sage",
  displayName: "Sage",
  envVars: {
    clientId: "SAGE_CLIENT_ID",
    clientSecret: "SAGE_CLIENT_SECRET",
    redirectUri: "SAGE_REDIRECT_URI",
  },
  buildAuthUrl: (c, state) => sage.buildAuthUrl(c.env, state),
  getConnection: (c) => sage.getConnection(c.get("db")),
  disconnect: (c) => sage.disconnect(c.get("db")),
  statusFields: (conn) => ({ businessName: conn.businessName }),
  completeConnection: async (c, code) => {
    const tokens = await sage.exchangeCode(c.env, code);
    const { businessId, businessName } = await sage.fetchBusiness(
      tokens.access_token,
    );
    await sage.storeConnection(c.get("db"), tokens, businessId, businessName);
  },
});

// ─── Sync endpoints ───────────────────────────────────────────────────────────

router.post("/sage/sync/contacts", requireRole("admin"), async (c) => {
  try {
    const results = await sage.syncAllContacts(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; clientId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/sage/sync/invoices", requireRole("admin"), async (c) => {
  try {
    const results = await sage.syncAllInvoices(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; invoiceId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/sage/sync/quotes", requireRole("admin"), async (c) => {
  try {
    const results = await sage.syncAllQuotes(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; quoteId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/sage/pull/payments", requireRole("admin"), async (c) => {
  try {
    const result = await sage.pullPayments(c.get("db"), c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default router;
