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
  buildAuthUrl: xero.buildAuthUrl,
  getConnection: xero.getConnection,
  disconnect: xero.disconnect,
  statusFields: (conn) => ({ tenantName: conn.tenantName }),
  completeConnection: async (code) => {
    const tokens = await xero.exchangeCode(code);
    const tenants = await xero.fetchTenants(tokens.access_token);
    if (!tenants.length)
      throw new Error("No Xero organisations found for this account.");

    // Use first org; multi-tenant selection could be added here
    const { tenantId, tenantName } = tenants[0];
    await xero.storeConnection(tokens, tenantId, tenantName);
  },
});

// ─── Sync endpoints ───────────────────────────────────────────────────────────

router.post("/xero/sync/contacts", requireRole("admin"), async (_req, res) => {
  try {
    const results = await xero.syncAllContacts();
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; clientId: string } => "error" in r,
    );
    res.json({ synced, failed: errors.length, errors });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/xero/sync/invoices", requireRole("admin"), async (_req, res) => {
  try {
    const results = await xero.syncAllInvoices();
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; invoiceId: string } => "error" in r,
    );
    res.json({ synced, failed: errors.length, errors });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/xero/sync/quotes", requireRole("admin"), async (_req, res) => {
  try {
    const results = await xero.syncAllQuotes();
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; quoteId: string } => "error" in r,
    );
    res.json({ synced, failed: errors.length, errors });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/xero/pull/payments", requireRole("admin"), async (_req, res) => {
  try {
    const result = await xero.pullPayments();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
