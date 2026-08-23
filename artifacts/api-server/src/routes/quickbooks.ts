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
  buildAuthUrl: quickbooks.buildAuthUrl,
  getConnection: quickbooks.getConnection,
  disconnect: quickbooks.disconnect,
  statusFields: (conn) => ({ companyName: conn.companyName }),
  completeConnection: async (code, query) => {
    const { realmId } = query;
    if (!realmId) throw new Error("No QuickBooks company (realmId) returned.");
    const tokens = await quickbooks.exchangeCode(code);
    const companyName = await quickbooks.fetchCompanyName(
      tokens.access_token,
      realmId,
    );
    await quickbooks.storeConnection(tokens, realmId, companyName);
  },
});

// ─── Sync endpoints ───────────────────────────────────────────────────────────

router.post(
  "/quickbooks/sync/contacts",
  requireRole("admin"),
  async (_req, res) => {
    try {
      const results = await quickbooks.syncAllContacts();
      const synced = results.filter((r) => !("error" in r)).length;
      const errors = results.filter(
        (r): r is { error: string; clientId: string } => "error" in r,
      );
      res.json({ synced, failed: errors.length, errors });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

router.post(
  "/quickbooks/sync/invoices",
  requireRole("admin"),
  async (_req, res) => {
    try {
      const results = await quickbooks.syncAllInvoices();
      const synced = results.filter((r) => !("error" in r)).length;
      const errors = results.filter(
        (r): r is { error: string; invoiceId: string } => "error" in r,
      );
      res.json({ synced, failed: errors.length, errors });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

router.post(
  "/quickbooks/sync/quotes",
  requireRole("admin"),
  async (_req, res) => {
    try {
      const results = await quickbooks.syncAllQuotes();
      const synced = results.filter((r) => !("error" in r)).length;
      const errors = results.filter(
        (r): r is { error: string; quoteId: string } => "error" in r,
      );
      res.json({ synced, failed: errors.length, errors });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

router.post(
  "/quickbooks/pull/payments",
  requireRole("admin"),
  async (_req, res) => {
    try {
      const result = await quickbooks.pullPayments();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

export default router;
