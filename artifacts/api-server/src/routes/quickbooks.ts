import * as quickbooks from "../lib/quickbooks.js";
import { requireRole } from "../lib/auth.js";
import { createAccountingOAuthRouter } from "./accountingOAuthFactory.js";

const router = createAccountingOAuthRouter({
  provider: "quickbooks",
  displayName: "QuickBooks",
  envVars: {
    clientId: "QUICKBOOKS_CLIENT_ID",
    clientSecret: "QUICKBOOKS_CLIENT_SECRET",
    redirectUri: "QUICKBOOKS_REDIRECT_URI",
  },
  buildAuthUrl: (c, state) => quickbooks.buildAuthUrl(c.env, state),
  getConnection: (c) => quickbooks.getConnection(c.get("db")),
  disconnect: (c) => quickbooks.disconnect(c.get("db")),
  statusFields: (conn) => ({ companyName: conn.companyName }),
  completeConnection: async (c, code, query) => {
    const { realmId } = query;
    if (!realmId) throw new Error("No QuickBooks company (realmId) returned.");
    const tokens = await quickbooks.exchangeCode(c.env, code);
    const companyName = await quickbooks.fetchCompanyName(
      tokens.access_token,
      realmId,
    );
    await quickbooks.storeConnection(c.get("db"), tokens, realmId, companyName);
  },
});

// ─── Sync endpoints ───────────────────────────────────────────────────────────

router.post("/quickbooks/sync/contacts", requireRole("admin"), async (c) => {
  try {
    const results = await quickbooks.syncAllContacts(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; clientId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/quickbooks/sync/invoices", requireRole("admin"), async (c) => {
  try {
    const results = await quickbooks.syncAllInvoices(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; invoiceId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/quickbooks/sync/quotes", requireRole("admin"), async (c) => {
  try {
    const results = await quickbooks.syncAllQuotes(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; quoteId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/quickbooks/pull/payments", requireRole("admin"), async (c) => {
  try {
    const result = await quickbooks.pullPayments(c.get("db"), c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default router;
