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
  buildAuthUrl: (c, state) => freeagent.buildAuthUrl(c.env, state),
  getConnection: (c) => freeagent.getConnection(c.get("db")),
  disconnect: (c) => freeagent.disconnect(c.get("db")),
  statusFields: (conn) => ({ companyName: conn.companyName }),
  completeConnection: async (c, code) => {
    const tokens = await freeagent.exchangeCode(c.env, code);
    const companyName = await freeagent.fetchCompanyName(tokens.access_token);
    await freeagent.storeConnection(c.get("db"), tokens, companyName);
  },
});

// ─── Sync endpoints ───────────────────────────────────────────────────────────

router.post("/freeagent/sync/contacts", requireRole("admin"), async (c) => {
  try {
    const results = await freeagent.syncAllContacts(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; clientId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/freeagent/sync/invoices", requireRole("admin"), async (c) => {
  try {
    const results = await freeagent.syncAllInvoices(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; invoiceId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/freeagent/sync/quotes", requireRole("admin"), async (c) => {
  try {
    const results = await freeagent.syncAllQuotes(c.get("db"), c.env);
    const synced = results.filter((r) => !("error" in r)).length;
    const errors = results.filter(
      (r): r is { error: string; quoteId: string } => "error" in r,
    );
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.post("/freeagent/pull/payments", requireRole("admin"), async (c) => {
  try {
    const result = await freeagent.pullPayments(c.get("db"), c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default router;
