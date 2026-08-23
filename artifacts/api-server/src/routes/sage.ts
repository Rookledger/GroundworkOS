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
  buildAuthUrl: sage.buildAuthUrl,
  getConnection: sage.getConnection,
  disconnect: sage.disconnect,
  statusFields: (conn) => ({ businessName: conn.businessName }),
  completeConnection: async (code) => {
    const tokens = await sage.exchangeCode(code);
    const { businessId, businessName } = await sage.fetchBusiness(
      tokens.access_token,
    );
    await sage.storeConnection(tokens, businessId, businessName);
  },
});

// ─── Sync endpoints ───────────────────────────────────────────────────────────

router.post("/sage/sync/contacts", requireRole("admin"), async (_req, res) => {
  try {
    const results = await sage.syncAllContacts();
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; clientId: string } => "error" in r,
    );
    res.json({ synced, failed: errors.length, errors });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/sage/sync/invoices", requireRole("admin"), async (_req, res) => {
  try {
    const results = await sage.syncAllInvoices();
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; invoiceId: string } => "error" in r,
    );
    res.json({ synced, failed: errors.length, errors });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/sage/sync/quotes", requireRole("admin"), async (_req, res) => {
  try {
    const results = await sage.syncAllQuotes();
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; quoteId: string } => "error" in r,
    );
    res.json({ synced, failed: errors.length, errors });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/sage/pull/payments", requireRole("admin"), async (_req, res) => {
  try {
    const result = await sage.pullPayments();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
