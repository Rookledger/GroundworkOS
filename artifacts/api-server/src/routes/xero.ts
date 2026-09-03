import type { Context } from "hono";
import * as xero from "../lib/xero.js";
import { requireRole } from "../lib/auth.js";
import { createAccountingOAuthRouter } from "./accountingOAuthFactory.js";
import type { AppEnv } from "../types";

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
  statusFields: (conn) => ({
    tenantName: conn.tenantName,
    salesAccountCode: conn.salesAccountCode ?? null,
    purchasesAccountCode: conn.purchasesAccountCode ?? null,
  }),
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

/**
 * Runs a batch sync helper (each returns an array of results where a failed
 * item is `{ error, ...idField }`), records the outcome to the sync log, and
 * responds the same way every one of these endpoints always has.
 */
async function runBatchSync<T extends Record<string, unknown>>(
  c: Context<AppEnv>,
  resource: string,
  run: () => Promise<T[]>,
) {
  try {
    const results = await run();
    const errors = results.filter(
      (r): r is T & { error: string } => typeof r.error === "string",
    );
    const synced = results.length - errors.length;
    await xero.recordSyncLog(c.get("db"), {
      direction: "push",
      resource,
      succeeded: synced,
      failed: errors.length,
    });
    return c.json({ synced, failed: errors.length, errors });
  } catch (err) {
    await xero.recordSyncLog(c.get("db"), {
      direction: "push",
      resource,
      succeeded: 0,
      failed: 0,
      detail: String(err),
    });
    return c.json({ error: String(err) }, 500);
  }
}

router.post("/xero/sync/contacts", requireRole("admin"), (c) =>
  runBatchSync(c, "contacts", () => xero.syncAllContacts(c.get("db"), c.env)),
);

router.post("/xero/sync/invoices", requireRole("admin"), (c) =>
  runBatchSync(c, "invoices", () => xero.syncAllInvoices(c.get("db"), c.env)),
);

router.post("/xero/sync/quotes", requireRole("admin"), (c) =>
  runBatchSync(c, "quotes", () => xero.syncAllQuotes(c.get("db"), c.env)),
);

router.post("/xero/sync/suppliers", requireRole("admin"), (c) =>
  runBatchSync(c, "suppliers", () => xero.syncAllSuppliers(c.get("db"), c.env)),
);

router.post("/xero/sync/bills", requireRole("admin"), (c) =>
  runBatchSync(c, "bills", () => xero.syncAllBills(c.get("db"), c.env)),
);

router.post("/xero/sync/credit-notes", requireRole("admin"), (c) =>
  runBatchSync(c, "credit_notes", () =>
    xero.syncAllCreditNotes(c.get("db"), c.env),
  ),
);

router.post("/xero/pull/payments", requireRole("admin"), async (c) => {
  try {
    const result = await xero.pullPayments(c.get("db"), c.env);
    await xero.recordSyncLog(c.get("db"), {
      direction: "pull",
      resource: "payments",
      succeeded: result.updated,
      failed: 0,
      detail: `${result.checked} checked`,
    });
    return c.json(result);
  } catch (err) {
    await xero.recordSyncLog(c.get("db"), {
      direction: "pull",
      resource: "payments",
      succeeded: 0,
      failed: 0,
      detail: String(err),
    });
    return c.json({ error: String(err) }, 500);
  }
});

// ─── Chart of accounts + default account code settings ──────────────────────

router.get("/xero/accounts", requireRole("admin"), async (c) => {
  try {
    const accounts = await xero.fetchAccounts(c.get("db"), c.env);
    return c.json({ accounts });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

router.put("/xero/settings", requireRole("admin"), async (c) => {
  try {
    const body = await c.req.json<{
      salesAccountCode?: string | null;
      purchasesAccountCode?: string | null;
    }>();
    const updated = await xero.updateSettings(c.get("db"), {
      salesAccountCode: body.salesAccountCode ?? null,
      purchasesAccountCode: body.purchasesAccountCode ?? null,
    });
    return c.json({
      salesAccountCode: updated.salesAccountCode,
      purchasesAccountCode: updated.purchasesAccountCode,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── Sync activity log ───────────────────────────────────────────────────────

router.get("/xero/sync/log", requireRole("admin"), async (c) => {
  try {
    const entries = await xero.getSyncLog(c.get("db"), 20);
    return c.json({ entries });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default router;
