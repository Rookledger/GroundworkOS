import {
  quickbooksConnectionTable,
  quickbooksClientMapTable,
  quickbooksInvoiceMapTable,
  quickbooksQuoteMapTable,
  clientsTable,
  invoicesTable,
  quotesTable,
  lineItemsTable,
} from "@workspace/db";
import type { Database } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Bindings } from "../types";

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API_BASE = "https://quickbooks.api.intuit.com/v3/company";

// ─── Credentials ────────────────────────────────────────────────────────────

function creds(env: Bindings) {
  const id = env.QUICKBOOKS_CLIENT_ID;
  const secret = env.QUICKBOOKS_CLIENT_SECRET;
  if (!id || !secret)
    throw new Error(
      "QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET not configured",
    );
  return { id, secret };
}

function basicAuth(env: Bindings) {
  const { id, secret } = creds(env);
  return "Basic " + btoa(`${id}:${secret}`);
}

// ─── Connection helpers ──────────────────────────────────────────────────────

export async function getConnection(db: Database) {
  const [conn] = await db.select().from(quickbooksConnectionTable).limit(1);
  return conn ?? null;
}

async function refreshIfNeeded(
  db: Database,
  env: Bindings,
  conn: typeof quickbooksConnectionTable.$inferSelect,
) {
  // Refresh 5 min before expiry
  if (Date.now() < new Date(conn.expiresAt).getTime() - 5 * 60 * 1000)
    return conn;
  return doRefresh(db, env, conn);
}

async function doRefresh(
  db: Database,
  env: Bindings,
  conn: typeof quickbooksConnectionTable.$inferSelect,
) {
  const r = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(env),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
    }),
  });
  if (!r.ok)
    throw new Error(
      `QuickBooks token refresh failed: ${r.status} ${await r.text()}`,
    );

  const t = (await r.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const expiresAt = new Date(Date.now() + t.expires_in * 1000);
  const updatedAt = new Date();

  const [updated] = await db
    .update(quickbooksConnectionTable)
    .set({
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt,
      updatedAt,
    })
    .where(eq(quickbooksConnectionTable.id, conn.id))
    .returning();
  return updated;
}

async function qbFetch(
  db: Database,
  env: Bindings,
  path: string,
  opts: RequestInit = {},
) {
  const conn = await getConnection(db);
  if (!conn) throw new Error("QuickBooks not connected");
  const fresh = await refreshIfNeeded(db, env, conn);

  const url = `${QB_API_BASE}/${fresh.realmId}${path}`;
  const r = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
  if (!r.ok) throw new Error(`QuickBooks API ${r.status}: ${await r.text()}`);
  return r.json() as Promise<Record<string, unknown>>;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function buildAuthUrl(env: Bindings, state: string) {
  const { id } = creds(env);
  const redirectUri = env.QUICKBOOKS_REDIRECT_URI;
  if (!redirectUri) throw new Error("QUICKBOOKS_REDIRECT_URI not configured");
  const params = new URLSearchParams({
    client_id: id,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state,
  });
  return `${QB_AUTH_URL}?${params}`;
}

export async function exchangeCode(env: Bindings, code: string) {
  const redirectUri = env.QUICKBOOKS_REDIRECT_URI;
  if (!redirectUri) throw new Error("QUICKBOOKS_REDIRECT_URI not configured");
  const r = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(env),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!r.ok)
    throw new Error(
      `QuickBooks auth code exchange failed: ${r.status} ${await r.text()}`,
    );
  return r.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function fetchCompanyName(accessToken: string, realmId: string) {
  const r = await fetch(`${QB_API_BASE}/${realmId}/companyinfo/${realmId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { CompanyInfo?: { CompanyName?: string } };
  return data.CompanyInfo?.CompanyName ?? null;
}

export async function storeConnection(
  db: Database,
  tokens: { access_token: string; refresh_token: string; expires_in: number },
  realmId: string,
  companyName: string | null,
) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await db.delete(quickbooksConnectionTable);
  await db.insert(quickbooksConnectionTable).values({
    id: "singleton",
    realmId,
    companyName,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    connectedAt: now,
    updatedAt: now,
  });
}

export async function disconnect(db: Database) {
  await db.delete(quickbooksConnectionTable);
  await db.delete(quickbooksClientMapTable);
  await db.delete(quickbooksInvoiceMapTable);
  await db.delete(quickbooksQuoteMapTable);
}

// ─── Contact sync ─────────────────────────────────────────────────────────────

export async function syncContact(
  db: Database,
  env: Bindings,
  clientId: string,
) {
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, clientId));
  if (!client) throw new Error(`Client ${clientId} not found`);

  const [existing] = await db
    .select()
    .from(quickbooksClientMapTable)
    .where(eq(quickbooksClientMapTable.clientId, clientId));

  const customer: Record<string, unknown> = { DisplayName: client.companyName };
  if (existing) {
    const current = (await qbFetch(
      db,
      env,
      `/customer/${existing.quickbooksCustomerId}`,
    )) as {
      Customer?: { SyncToken: string };
    };
    customer.Id = existing.quickbooksCustomerId;
    customer.SyncToken = current.Customer?.SyncToken ?? "0";
    customer.sparse = true;
  }
  if (client.email) customer.PrimaryEmailAddr = { Address: client.email };
  if (client.phone) customer.PrimaryPhone = { FreeFormNumber: client.phone };
  if (client.address) customer.BillAddr = { Line1: client.address };

  const r = (await qbFetch(db, env, "/customer", {
    method: "POST",
    body: JSON.stringify(customer),
  })) as { Customer?: { Id: string } };

  const quickbooksCustomerId = r.Customer?.Id;
  if (!quickbooksCustomerId)
    throw new Error("No Customer Id returned from QuickBooks");

  await db
    .insert(quickbooksClientMapTable)
    .values({ clientId, quickbooksCustomerId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: quickbooksClientMapTable.clientId,
      set: { quickbooksCustomerId, syncedAt: new Date() },
    });

  return { clientId, quickbooksCustomerId };
}

export async function syncAllContacts(db: Database, env: Bindings) {
  const clients = await db.select().from(clientsTable);
  return Promise.all(
    clients.map((cl) =>
      syncContact(db, env, cl.id).catch((e) => ({
        error: String(e),
        clientId: cl.id,
      })),
    ),
  );
}

// ─── Invoice sync ─────────────────────────────────────────────────────────────

async function ensureContact(
  db: Database,
  env: Bindings,
  clientId: string | null,
) {
  if (!clientId) return undefined;
  const [map] = await db
    .select()
    .from(quickbooksClientMapTable)
    .where(eq(quickbooksClientMapTable.clientId, clientId));
  if (map) return map.quickbooksCustomerId;
  const r = await syncContact(db, env, clientId);
  return r.quickbooksCustomerId;
}

export async function syncInvoice(
  db: Database,
  env: Bindings,
  invoiceId: string,
) {
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId));
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const quickbooksCustomerId = await ensureContact(db, env, invoice.clientId);
  if (!quickbooksCustomerId)
    throw new Error("Invoice has no client to bill in QuickBooks");

  const [existingMap] = await db
    .select()
    .from(quickbooksInvoiceMapTable)
    .where(eq(quickbooksInvoiceMapTable.invoiceId, invoiceId));

  const qbInvoice: Record<string, unknown> = {
    DocNumber: invoice.invoiceNumber,
    TxnDate: invoice.issuedDate,
    DueDate: invoice.dueDate ?? invoice.issuedDate,
    CustomerRef: { value: quickbooksCustomerId },
    Line: [
      {
        DetailType: "SalesItemLineDetail",
        Amount: invoice.subtotal,
        Description: `Construction services — ${invoice.invoiceNumber}`,
        SalesItemLineDetail: { UnitPrice: invoice.subtotal, Qty: 1 },
      },
    ],
  };

  if (existingMap) {
    const current = (await qbFetch(
      db,
      env,
      `/invoice/${existingMap.quickbooksInvoiceId}`,
    )) as {
      Invoice?: { SyncToken: string };
    };
    qbInvoice.Id = existingMap.quickbooksInvoiceId;
    qbInvoice.SyncToken = current.Invoice?.SyncToken ?? "0";
  }
  if (invoice.notes) qbInvoice.PrivateNote = invoice.notes;

  const r = (await qbFetch(db, env, "/invoice", {
    method: "POST",
    body: JSON.stringify(qbInvoice),
  })) as { Invoice?: { Id: string } };

  const quickbooksInvoiceId = r.Invoice?.Id;
  if (!quickbooksInvoiceId)
    throw new Error("No Invoice Id returned from QuickBooks");

  await db
    .insert(quickbooksInvoiceMapTable)
    .values({ invoiceId, quickbooksInvoiceId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: quickbooksInvoiceMapTable.invoiceId,
      set: { quickbooksInvoiceId, syncedAt: new Date() },
    });

  return { invoiceId, quickbooksInvoiceId };
}

export async function syncAllInvoices(db: Database, env: Bindings) {
  const invoices = await db.select().from(invoicesTable);
  return Promise.all(
    invoices.map((inv) =>
      syncInvoice(db, env, inv.id).catch((e) => ({
        error: String(e),
        invoiceId: inv.id,
      })),
    ),
  );
}

// ─── Quote (Estimate) sync ─────────────────────────────────────────────────────

export async function syncQuote(
  db: Database,
  env: Bindings,
  quoteId: string,
) {
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.id, quoteId));
  if (!quote) throw new Error(`Quote ${quoteId} not found`);

  const lineItems = await db
    .select()
    .from(lineItemsTable)
    .where(eq(lineItemsTable.quoteId, quoteId));

  const quickbooksCustomerId = await ensureContact(db, env, quote.clientId);
  if (!quickbooksCustomerId)
    throw new Error("Quote has no client to bill in QuickBooks");

  const [existingMap] = await db
    .select()
    .from(quickbooksQuoteMapTable)
    .where(eq(quickbooksQuoteMapTable.quoteId, quoteId));

  const line =
    lineItems.length > 0
      ? lineItems.map((li) => ({
          DetailType: "SalesItemLineDetail",
          Amount: li.total,
          Description: li.description,
          SalesItemLineDetail: { UnitPrice: li.unitPrice, Qty: li.quantity },
        }))
      : [
          {
            DetailType: "SalesItemLineDetail",
            Amount: quote.subtotal,
            Description: quote.title ?? `Quote ${quote.quoteNumber}`,
            SalesItemLineDetail: { UnitPrice: quote.subtotal, Qty: 1 },
          },
        ];

  const qbEstimate: Record<string, unknown> = {
    DocNumber: quote.quoteNumber,
    CustomerRef: { value: quickbooksCustomerId },
    Line: line,
  };

  if (existingMap) {
    const current = (await qbFetch(
      db,
      env,
      `/estimate/${existingMap.quickbooksEstimateId}`,
    )) as {
      Estimate?: { SyncToken: string };
    };
    qbEstimate.Id = existingMap.quickbooksEstimateId;
    qbEstimate.SyncToken = current.Estimate?.SyncToken ?? "0";
  }
  if (quote.notes) qbEstimate.CustomerMemo = { value: quote.notes };
  if (quote.validUntil) qbEstimate.ExpirationDate = quote.validUntil;

  const r = (await qbFetch(db, env, "/estimate", {
    method: "POST",
    body: JSON.stringify(qbEstimate),
  })) as { Estimate?: { Id: string } };

  const quickbooksEstimateId = r.Estimate?.Id;
  if (!quickbooksEstimateId)
    throw new Error("No Estimate Id returned from QuickBooks");

  await db
    .insert(quickbooksQuoteMapTable)
    .values({ quoteId, quickbooksEstimateId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: quickbooksQuoteMapTable.quoteId,
      set: { quickbooksEstimateId, syncedAt: new Date() },
    });

  return { quoteId, quickbooksEstimateId };
}

export async function syncAllQuotes(db: Database, env: Bindings) {
  const quotes = await db.select().from(quotesTable);
  return Promise.all(
    quotes.map((q) =>
      syncQuote(db, env, q.id).catch((e) => ({
        error: String(e),
        quoteId: q.id,
      })),
    ),
  );
}

// ─── Pull payments from QuickBooks ───────────────────────────────────────────

export async function pullPayments(db: Database, env: Bindings) {
  const maps = await db.select().from(quickbooksInvoiceMapTable);
  let updated = 0;

  for (const { invoiceId, quickbooksInvoiceId } of maps) {
    const r = (await qbFetch(db, env, `/invoice/${quickbooksInvoiceId}`)) as {
      Invoice?: { Balance?: number; TotalAmt?: number };
    };
    const balance = r.Invoice?.Balance ?? r.Invoice?.TotalAmt ?? 1;
    if (balance > 0) continue;

    const [inv] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId));
    if (!inv || inv.status === "paid") continue;
    await db
      .update(invoicesTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(invoicesTable.id, invoiceId));
    updated++;
  }

  return { checked: maps.length, updated };
}
