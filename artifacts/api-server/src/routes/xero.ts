import * as xero from "../lib/xero.js";
import { requireRole } from "../lib/auth.js";
import { createAccountingOAuthRouter } from "./accountingOAuthFactory.js";

const router = createAccountingOAuthRouter({
  provider: "xero",
  displayName: "Xero",
  envVars: {
    clientId: "XERO_CLIENT_ID",
    clientSecret: "XERO_CLIENT_SECRET",
    redirectUri: "XERO_REDIRECT_URI",
  },
  buildAuthUrl: (c, state) => xero.buildAuthUrl(c.env, state),
  getConnection: (c) => xero.getConnection(c.get("db")),
  disconnect: (c) => xero.disconnect(c.get("db")),
  statusFields: (conn) => ({ tenantName: conn.tenantName }),
  completeConnection: async (c, code) => {
    const tokens = await xero.exchangeCode(c.env, code);
    const tenants = await xero.fetchTenants(tokens.access_token);
    if (!tenants.length)
      throw new Error("No Xero organisations found for this account.");

    // Use first org; multi-tenant selection could be added here
    const { tenantId, tenantName } = tenants[0];
    await xero.storeConnection(c.get("db"), tokens, tenantId, tenantName);
  },
});

// ─── Sync endpoints ───────────────────────────────────────────────────────────

router.post("/xero/sync/contacts", requireRole("admin"), async (c) => {
  try {
    const results = await xero.syncAllContacts(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; clientId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/xero/sync/invoices", requireRole("admin"), async (c) => {
  try {
    const results = await xero.syncAllInvoices(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; invoiceId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/xero/sync/quotes", requireRole("admin"), async (c) => {
  try {
    const results = await xero.syncAllQuotes(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; quoteId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/xero/pull/payments", requireRole("admin"), async (c) => {
  try {
    const result = await xero.pullPayments(c.get("db"), c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default router;
