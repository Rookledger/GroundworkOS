import * as freeagent from "../lib/freeagent.js";
import { requireRole } from "../lib/auth.js";
import { createAccountingOAuthRouter } from "./accountingOAuthFactory.js";

const router = createAccountingOAuthRouter({
  provider: "freeagent",
  displayName: "FreeAgent",
  envVars: {
    clientId: "FREEAGENT_CLIENT_ID",
    clientSecret: "FREEAGENT_CLIENT_SECRET",
    redirectUri: "FREEAGENT_REDIRECT_URI",
  },
  buildAuthUrl: freeagent.buildAuthUrl,
  getConnection: freeagent.getConnection,
  disconnect: freeagent.disconnect,
  statusFields: (conn) => ({ companyName: conn.companyName }),
  completeConnection: async (code) => {
    const tokens = await freeagent.exchangeCode(code);
    const companyName = await freeagent.fetchCompanyName(tokens.access_token);
    await freeagent.storeConnection(tokens, companyName);
  },
});

// ─── Sync endpoints ───────────────────────────────────────────────────────────

router.post(
  "/freeagent/sync/contacts",
  requireRole("admin"),
  async (_req, res) => {
    try {
      const results = await freeagent.syncAllContacts();
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
  "/freeagent/sync/invoices",
  requireRole("admin"),
  async (_req, res) => {
    try {
      const results = await freeagent.syncAllInvoices();
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
  "/freeagent/sync/quotes",
  requireRole("admin"),
  async (_req, res) => {
    try {
      const results = await freeagent.syncAllQuotes();
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
  "/freeagent/pull/payments",
  requireRole("admin"),
  async (_req, res) => {
    try {
      const result = await freeagent.pullPayments();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

export default router;
