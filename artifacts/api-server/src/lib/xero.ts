import {
  xeroConnectionTable,
  xeroClientMapTable,
  xeroInvoiceMapTable,
  xeroQuoteMapTable,
  xeroSupplierMapTable,
  xeroBillMapTable,
  xeroCreditNoteMapTable,
  xeroSyncLogTable,
  clientsTable,
  invoicesTable,
  quotesTable,
  lineItemsTable,
  subcontractorsTable,
  purchaseOrdersTable,
} from "@workspace/db";
import type { Database } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { Bindings } from "../types";
import { generateId } from "./generateId.js";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const XERO_API = "https://api.xero.com/api.xro/2.0";

// ─── Credentials ────────────────────────────────────────────────────────────

function creds(env: Bindings) {
  const id = env.XERO_CLIENT_ID;
  const secret = env.XERO_CLIENT_SECRET;
  if (!id || !secret)
    throw new Error("XERO_CLIENT_ID / XERO_CLIENT_SECRET not configured");
  return { id, secret };
}

function basicAuth(env: Bindings) {
  const { id, secret } = creds(env);
  return "Basic " + btoa(`${id}:${secret}`);
}

// ─── Connection helpers ──────────────────────────────────────────────────────

export async function getConnection(db: Database) {
  const [conn] = await db.select().from(xeroConnectionTable).limit(1);
  return conn ?? null;
}

// Note: no module-level `refreshInFlight` de-duplication here anymore - a
// Worker isolate does not stay warm across requests the way a long-lived
// Node process did, so a module-level Promise cache would rarely, if ever,
// actually be shared between concurrent requests. Each request that needs a
// refresh just does its own; the stored refresh token still gets replaced
// atomically by the UPDATE below.
async function refreshIfNeeded(
  db: Database,
  env: Bindings,
  conn: typeof xeroConnectionTable.$inferSelect,
) {
  // Refresh 5 min before expiry
  if (Date.now() < new Date(conn.expiresAt).getTime() - 5 * 60 * 1000)
    return conn;
  return doRefresh(db, env, conn);
}

async function doRefresh(
  db: Database,
  env: Bindings,
  conn: typeof xeroConnectionTable.$inferSelect,
) {
  const r = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(env),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
    }),
  });
  if (!r.ok)
    throw new Error(`Xero token refresh failed: ${r.status} ${await r.text()}`);

  const t = (await r.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const expiresAt = new Date(Date.now() + t.expires_in * 1000);
  const updatedAt = new Date();

  const [updated] = await db
    .update(xeroConnectionTable)
    .set({
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt,
      updatedAt,
    })
    .where(eq(xeroConnectionTable.id, conn.id))
    .returning();
  return updated;
}

async function xeroFetch(
  db: Database,
  env: Bindings,
  path: string,
  opts: RequestInit = {},
) {
  const conn = await getConnection(db);
  if (!conn) throw new Error("Xero not connected");
  const fresh = await refreshIfNeeded(db, env, conn);

  const url = path.startsWith("http") ? path : `${XERO_API}${path}`;
  const r = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      "Xero-Tenant-ID": fresh.tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
  if (!r.ok) throw new Error(`Xero API ${r.status}: ${await r.text()}`);
  return r.json() as Promise<Record<string, unknown>>;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function buildAuthUrl(env: Bindings, state: string) {
  const { id } = creds(env);
  const redirectUri = env.XERO_REDIRECT_URI;
  if (!redirectUri) throw new Error("XERO_REDIRECT_URI not configured");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: id,
    redirect_uri: redirectUri,
    // accounting.transactions was retired for apps created after 2 Mar 2026;
    // Xero rejects it with invalid_scope. accounting.invoices is its granular
    // replacement and also covers Quotes (see Xero's scope migration guide).
    // accounting.settings.read is required for GET /Accounts (chart of
    // accounts). Without it the Default Account Codes dropdowns on the
    // Settings page can never populate, invoices/bills/credit notes push
    // with no AccountCode, and Xero rejects them with a 400
    // ValidationException ("Account code or ID must be specified").
    scope:
      "openid profile email accounting.contacts accounting.invoices accounting.settings.read offline_access",
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${params}`;
}

export async function exchangeCode(env: Bindings, code: string) {
  const redirectUri = env.XERO_REDIRECT_URI;
  if (!redirectUri) throw new Error("XERO_REDIRECT_URI not configured");
  const r = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(env),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!r.ok)
    throw new Error(
      `Xero auth code exchange failed: ${r.status} ${await r.text()}`,
    );
  return r.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function fetchTenants(accessToken: string) {
  const r = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) throw new Error(`Failed to fetch Xero tenants: ${r.status}`);
  return r.json() as Promise<
    Array<{ tenantId: string; tenantName: string; tenantType: string }>
  >;
}

export async function storeConnection(
  db: Database,
  tokens: { access_token: string; refresh_token: string; expires_in: number },
  tenantId: string,
  tenantName: string,
) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await db.delete(xeroConnectionTable);
  await db.insert(xeroConnectionTable).values({
    id: "singleton",
    tenantId,
    tenantName,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    connectedAt: now,
    updatedAt: now,
  });
}

export async function disconnect(db: Database) {
  await db.delete(xeroConnectionTable);
  await db.delete(xeroClientMapTable);
  await db.delete(xeroInvoiceMapTable);
  await db.delete(xeroQuoteMapTable);
  await db.delete(xeroSupplierMapTable);
  await db.delete(xeroBillMapTable);
  await db.delete(xeroCreditNoteMapTable);
  // Sync log is kept intentionally - it's an audit trail of what was pushed
  // or pulled while connected, which stays useful (e.g. "when did we last
  // push invoices to Xero?") even after disconnecting.
}

// ─── Settings (default account codes) ────────────────────────────────────────

export async function updateSettings(
  db: Database,
  fields: {
    salesAccountCode?: string | null;
    purchasesAccountCode?: string | null;
  },
) {
  const conn = await getConnection(db);
  if (!conn) throw new Error("Xero not connected");
  const [updated] = await db
    .update(xeroConnectionTable)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(xeroConnectionTable.id, conn.id))
    .returning();
  return updated;
}

// ─── Sync activity log ───────────────────────────────────────────────────────

export async function recordSyncLog(
  db: Database,
  entry: {
    direction: "push" | "pull";
    resource: string;
    succeeded: number;
    failed: number;
    detail?: string;
  },
) {
  await db.insert(xeroSyncLogTable).values({
    id: generateId(),
    direction: entry.direction,
    resource: entry.resource,
    succeeded: entry.succeeded,
    failed: entry.failed,
    detail: entry.detail ?? null,
    createdAt: new Date(),
  });
}

export async function getSyncLog(db: Database, limit = 20) {
  return db
    .select()
    .from(xeroSyncLogTable)
    .orderBy(desc(xeroSyncLogTable.createdAt))
    .limit(limit);
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
    .from(xeroClientMapTable)
    .where(eq(xeroClientMapTable.clientId, clientId));

  const contact: Record<string, unknown> = {
    Name: client.companyName,
    IsCustomer: true,
  };
  if (existing) contact.ContactID = existing.xeroContactId;
  if (client.email) contact.EmailAddress = client.email;
  if (client.phone)
    contact.Phones = [{ PhoneType: "DEFAULT", PhoneNumber: client.phone }];
  if (client.address)
    contact.Addresses = [
      { AddressType: "POBOX", AddressLine1: client.address },
    ];

  const r = (await xeroFetch(db, env, "/Contacts", {
    method: "POST",
    body: JSON.stringify({ Contacts: [contact] }),
  })) as { Contacts?: Array<{ ContactID: string }> };

  const xeroContactId = r.Contacts?.[0]?.ContactID;
  if (!xeroContactId) throw new Error("No ContactID returned from Xero");

  await db
    .insert(xeroClientMapTable)
    .values({ clientId, xeroContactId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: xeroClientMapTable.clientId,
      set: { xeroContactId, syncedAt: new Date() },
    });

  return { clientId, xeroContactId };
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

const INVOICE_STATUS: Record<string, string> = {
  draft: "DRAFT",
  sent: "AUTHORISED",
  paid: "AUTHORISED",
  overdue: "AUTHORISED",
  credited: "VOIDED",
};

async function ensureContact(
  db: Database,
  env: Bindings,
  clientId: string | null,
) {
  if (!clientId) return undefined;
  const [map] = await db
    .select()
    .from(xeroClientMapTable)
    .where(eq(xeroClientMapTable.clientId, clientId));
  if (map) return map.xeroContactId;
  const r = await syncContact(db, env, clientId);
  return r.xeroContactId;
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

  const xeroContactId = await ensureContact(db, env, invoice.clientId);
  const conn = await getConnection(db);

  const [existingMap] = await db
    .select()
    .from(xeroInvoiceMapTable)
    .where(eq(xeroInvoiceMapTable.invoiceId, invoiceId));

  const xeroInvoice: Record<string, unknown> = {
    Type: "ACCREC",
    InvoiceNumber: invoice.invoiceNumber,
    Status: INVOICE_STATUS[invoice.status] ?? "DRAFT",
    Date: invoice.issuedDate,
    DueDate: invoice.dueDate ?? invoice.issuedDate,
    // Xero's LineAmountTypes enum is Pascal-case ("Exclusive" / "Inclusive" /
    // "NoTax"). Sending "EXCLUSIVE" trips a 400 ValidationException on every
    // invoice sync.
    LineAmountTypes: "Exclusive",
    LineItems: [
      {
        Description: `Construction services — ${invoice.invoiceNumber}`,
        Quantity: 1,
        UnitAmount: invoice.subtotal,
        TaxType: invoice.vatAmount > 0 ? "OUTPUT2" : "NONE",
        TaxAmount: invoice.vatAmount,
        LineAmount: invoice.subtotal,
        ...(conn?.salesAccountCode
          ? { AccountCode: conn.salesAccountCode }
          : {}),
      },
    ],
  };

  if (xeroContactId) xeroInvoice.Contact = { ContactID: xeroContactId };
  if (existingMap) xeroInvoice.InvoiceID = existingMap.xeroInvoiceId;
  if (invoice.notes) xeroInvoice.Reference = invoice.notes;
  if (invoice.cisDeduction && invoice.cisDeduction > 0) {
    xeroInvoice.CISDeduction = invoice.cisDeduction;
  }

  const r = (await xeroFetch(db, env, "/Invoices", {
    method: "POST",
    body: JSON.stringify({ Invoices: [xeroInvoice] }),
  })) as { Invoices?: Array<{ InvoiceID: string }> };

  const xeroInvoiceId = r.Invoices?.[0]?.InvoiceID;
  if (!xeroInvoiceId) throw new Error("No InvoiceID returned from Xero");

  await db
    .insert(xeroInvoiceMapTable)
    .values({ invoiceId, xeroInvoiceId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: xeroInvoiceMapTable.invoiceId,
      set: { xeroInvoiceId, syncedAt: new Date() },
    });

  return { invoiceId, xeroInvoiceId };
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

// ─── Quote sync ───────────────────────────────────────────────────────────────

const QUOTE_STATUS: Record<string, string> = {
  draft: "DRAFT",
  sent: "SENT",
  accepted: "ACCEPTED",
  declined: "DECLINED",
  expired: "DELETED",
};

export async function syncQuote(db: Database, env: Bindings, quoteId: string) {
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.id, quoteId));
  if (!quote) throw new Error(`Quote ${quoteId} not found`);

  const lineItems = await db
    .select()
    .from(lineItemsTable)
    .where(eq(lineItemsTable.quoteId, quoteId));

  const xeroContactId = await ensureContact(db, env, quote.clientId);
  const conn = await getConnection(db);
  const accountCode = conn?.salesAccountCode
    ? { AccountCode: conn.salesAccountCode }
    : {};

  const [existingMap] = await db
    .select()
    .from(xeroQuoteMapTable)
    .where(eq(xeroQuoteMapTable.quoteId, quoteId));

  const xeroQuote: Record<string, unknown> = {
    QuoteNumber: quote.quoteNumber,
    Status: QUOTE_STATUS[quote.status] ?? "DRAFT",
    Date: quote.createdAt.toISOString().slice(0, 10),
    // See the matching comment in syncInvoice: Xero expects Pascal-case here.
    LineAmountTypes: "Exclusive",
    LineItems:
      lineItems.length > 0
        ? lineItems.map((li) => ({
            Description: li.description,
            Quantity: li.quantity,
            UnitAmount: li.unitPrice,
            TaxType: "OUTPUT2",
            LineAmount: li.total,
            ...accountCode,
          }))
        : [
            {
              Description: quote.title ?? `Quote ${quote.quoteNumber}`,
              Quantity: 1,
              UnitAmount: quote.subtotal,
              TaxType: "OUTPUT2",
              LineAmount: quote.subtotal,
              ...accountCode,
            },
          ],
  };

  if (xeroContactId) xeroQuote.Contact = { ContactID: xeroContactId };
  if (existingMap) xeroQuote.QuoteID = existingMap.xeroQuoteId;
  if (quote.title) xeroQuote.Title = quote.title;
  if (quote.validUntil) xeroQuote.ExpiryDate = quote.validUntil;
  if (quote.notes) xeroQuote.Summary = quote.notes;

  const r = (await xeroFetch(db, env, "/Quotes", {
    method: "POST",
    body: JSON.stringify({ Quotes: [xeroQuote] }),
  })) as { Quotes?: Array<{ QuoteID: string }> };

  const xeroQuoteId = r.Quotes?.[0]?.QuoteID;
  if (!xeroQuoteId) throw new Error("No QuoteID returned from Xero");

  await db
    .insert(xeroQuoteMapTable)
    .values({ quoteId, xeroQuoteId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: xeroQuoteMapTable.quoteId,
      set: { xeroQuoteId, syncedAt: new Date() },
    });

  return { quoteId, xeroQuoteId };
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

// ─── Pull payments from Xero ─────────────────────────────────────────────────

export async function pullPayments(db: Database, env: Bindings) {
  const r = (await xeroFetch(
    db,
    env,
    "/Invoices?Statuses=PAID&Type=ACCREC",
  )) as {
    Invoices?: Array<{ InvoiceID: string }>;
  };
  const paidXeroIds = new Set((r.Invoices ?? []).map((i) => i.InvoiceID));

  const maps = await db.select().from(xeroInvoiceMapTable);
  let updated = 0;

  for (const { invoiceId, xeroInvoiceId } of maps) {
    if (!paidXeroIds.has(xeroInvoiceId)) continue;
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

// ─── Supplier sync (subcontractors pushed as Xero supplier contacts) ────────

export async function syncSupplier(
  db: Database,
  env: Bindings,
  subcontractorId: string,
) {
  const [sub] = await db
    .select()
    .from(subcontractorsTable)
    .where(eq(subcontractorsTable.id, subcontractorId));
  if (!sub) throw new Error(`Subcontractor ${subcontractorId} not found`);

  const [existing] = await db
    .select()
    .from(xeroSupplierMapTable)
    .where(eq(xeroSupplierMapTable.subcontractorId, subcontractorId));

  const contact: Record<string, unknown> = {
    Name: sub.companyName,
    IsSupplier: true,
  };
  if (existing) contact.ContactID = existing.xeroContactId;
  if (sub.email) contact.EmailAddress = sub.email;
  if (sub.phone)
    contact.Phones = [{ PhoneType: "DEFAULT", PhoneNumber: sub.phone }];
  if (sub.address)
    contact.Addresses = [{ AddressType: "POBOX", AddressLine1: sub.address }];

  const r = (await xeroFetch(db, env, "/Contacts", {
    method: "POST",
    body: JSON.stringify({ Contacts: [contact] }),
  })) as { Contacts?: Array<{ ContactID: string }> };

  const xeroContactId = r.Contacts?.[0]?.ContactID;
  if (!xeroContactId) throw new Error("No ContactID returned from Xero");

  await db
    .insert(xeroSupplierMapTable)
    .values({ subcontractorId, xeroContactId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: xeroSupplierMapTable.subcontractorId,
      set: { xeroContactId, syncedAt: new Date() },
    });

  return { subcontractorId, xeroContactId };
}

export async function syncAllSuppliers(db: Database, env: Bindings) {
  const subs = await db.select().from(subcontractorsTable);
  return Promise.all(
    subs.map((s) =>
      syncSupplier(db, env, s.id).catch((e) => ({
        error: String(e),
        subcontractorId: s.id,
      })),
    ),
  );
}

/**
 * Best-effort match of a purchase order's free-text `supplier` field to a
 * known subcontractor, so bills for CIS-registered subcontractors carry the
 * right Xero contact and CIS deduction. Purchase orders don't have a formal
 * subcontractorId FK (the field predates the subcontractors table), so this
 * matches on company name case-insensitively - it's a heuristic, not a hard
 * link, and simply falls through to a plain Name-only Xero contact when
 * nothing matches.
 */
async function matchSupplierSubcontractor(db: Database, supplierName: string) {
  const subs = await db.select().from(subcontractorsTable);
  return (
    subs.find(
      (s) =>
        s.companyName.trim().toLowerCase() ===
        supplierName.trim().toLowerCase(),
    ) ?? null
  );
}

async function ensureSupplierContact(
  db: Database,
  env: Bindings,
  supplierName: string,
) {
  const sub = await matchSupplierSubcontractor(db, supplierName);
  if (!sub) return { xeroContactId: undefined, subcontractor: null };

  const [map] = await db
    .select()
    .from(xeroSupplierMapTable)
    .where(eq(xeroSupplierMapTable.subcontractorId, sub.id));
  if (map) return { xeroContactId: map.xeroContactId, subcontractor: sub };

  const r = await syncSupplier(db, env, sub.id);
  return { xeroContactId: r.xeroContactId, subcontractor: sub };
}

// ─── Bill sync (purchase orders pushed as Xero ACCPAY bills) ────────────────

// Matches PurchaseOrderStatus in artifacts/groundworkos/src/types.ts.
const PO_STATUS: Record<string, string> = {
  draft: "DRAFT",
  ordered: "AUTHORISED",
  received: "AUTHORISED",
  invoiced: "AUTHORISED",
};

export async function syncBill(
  db: Database,
  env: Bindings,
  purchaseOrderId: string,
) {
  const [po] = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.id, purchaseOrderId));
  if (!po) throw new Error(`Purchase order ${purchaseOrderId} not found`);

  const { xeroContactId, subcontractor } = await ensureSupplierContact(
    db,
    env,
    po.supplier,
  );
  const conn = await getConnection(db);

  const [existingMap] = await db
    .select()
    .from(xeroBillMapTable)
    .where(eq(xeroBillMapTable.purchaseOrderId, purchaseOrderId));

  const xeroBill: Record<string, unknown> = {
    Type: "ACCPAY",
    InvoiceNumber: po.poNumber,
    Status: PO_STATUS[po.status] ?? "DRAFT",
    Date: po.orderDate,
    DueDate: po.deliveryDate ?? po.expectedDelivery ?? po.orderDate,
    LineAmountTypes: "Exclusive",
    LineItems: [
      {
        Description: po.description,
        Quantity: 1,
        UnitAmount: po.amount,
        TaxType: po.vatAmount > 0 ? "INPUT2" : "NONE",
        TaxAmount: po.vatAmount,
        LineAmount: po.amount,
        ...(conn?.purchasesAccountCode
          ? { AccountCode: conn.purchasesAccountCode }
          : {}),
      },
    ],
  };

  if (xeroContactId) xeroBill.Contact = { ContactID: xeroContactId };
  else xeroBill.Contact = { Name: po.supplier };
  if (existingMap) xeroBill.InvoiceID = existingMap.xeroBillId;
  if (po.notes) xeroBill.Reference = po.notes;

  // CIS deduction only applies to subcontractors verified for net payment -
  // "gross" subcontractors are paid without deduction, and "unverified"
  // subcontractors shouldn't be paid (let alone deducted) until HMRC
  // verification completes, so leave that case alone rather than guessing.
  if (subcontractor && subcontractor.cisStatus === "net") {
    const deduction =
      Math.round(po.amount * (subcontractor.cisDeductionRate / 100) * 100) /
      100;
    if (deduction > 0) xeroBill.CISDeduction = deduction;
  }

  const r = (await xeroFetch(db, env, "/Invoices", {
    method: "POST",
    body: JSON.stringify({ Invoices: [xeroBill] }),
  })) as { Invoices?: Array<{ InvoiceID: string }> };

  const xeroBillId = r.Invoices?.[0]?.InvoiceID;
  if (!xeroBillId) throw new Error("No InvoiceID returned from Xero");

  await db
    .insert(xeroBillMapTable)
    .values({ purchaseOrderId, xeroBillId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: xeroBillMapTable.purchaseOrderId,
      set: { xeroBillId, syncedAt: new Date() },
    });

  return { purchaseOrderId, xeroBillId };
}

export async function syncAllBills(db: Database, env: Bindings) {
  const orders = await db.select().from(purchaseOrdersTable);
  return Promise.all(
    orders.map((po) =>
      syncBill(db, env, po.id).catch((e) => ({
        error: String(e),
        purchaseOrderId: po.id,
      })),
    ),
  );
}

// ─── Credit notes (credited invoices pushed as Xero ACCRECCREDIT notes) ─────

/**
 * Pushes a real Xero credit note (ACCRECCREDIT) for every invoice marked
 * "credited" in GroundworkOS that doesn't already have one, and allocates it
 * against the original Xero invoice when that invoice was itself synced.
 * This is deliberately a separate, opt-in action rather than something
 * syncInvoice does automatically on status change - voiding or crediting an
 * invoice that's already been reconciled in Xero has real accounting
 * consequences, so it stays a manual, explicit push.
 */
export async function syncCreditNote(
  db: Database,
  env: Bindings,
  invoiceId: string,
) {
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId));
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
  if (invoice.status !== "credited")
    throw new Error(`Invoice ${invoiceId} is not marked as credited`);

  const [existing] = await db
    .select()
    .from(xeroCreditNoteMapTable)
    .where(eq(xeroCreditNoteMapTable.invoiceId, invoiceId));
  if (existing)
    return { invoiceId, xeroCreditNoteId: existing.xeroCreditNoteId };

  const xeroContactId = await ensureContact(db, env, invoice.clientId);
  const conn = await getConnection(db);

  const creditNote: Record<string, unknown> = {
    Type: "ACCRECCREDIT",
    Date: new Date().toISOString().slice(0, 10),
    LineAmountTypes: "Exclusive",
    LineItems: [
      {
        Description: `Credit — ${invoice.invoiceNumber}`,
        Quantity: 1,
        UnitAmount: invoice.subtotal,
        TaxType: invoice.vatAmount > 0 ? "OUTPUT2" : "NONE",
        TaxAmount: invoice.vatAmount,
        LineAmount: invoice.subtotal,
        ...(conn?.salesAccountCode
          ? { AccountCode: conn.salesAccountCode }
          : {}),
      },
    ],
  };
  if (xeroContactId) creditNote.Contact = { ContactID: xeroContactId };
  if (invoice.notes) creditNote.Reference = invoice.notes;

  const r = (await xeroFetch(db, env, "/CreditNotes", {
    method: "POST",
    body: JSON.stringify({ CreditNotes: [creditNote] }),
  })) as { CreditNotes?: Array<{ CreditNoteID: string }> };

  const xeroCreditNoteId = r.CreditNotes?.[0]?.CreditNoteID;
  if (!xeroCreditNoteId) throw new Error("No CreditNoteID returned from Xero");

  // Allocate against the original invoice when we know its Xero ID, so the
  // credit actually offsets the invoice in Xero rather than sitting
  // unapplied. Best-effort: allocation failing (e.g. the original invoice
  // was already fully paid or voided in Xero) shouldn't block recording that
  // the credit note itself was created successfully.
  const [invoiceMap] = await db
    .select()
    .from(xeroInvoiceMapTable)
    .where(eq(xeroInvoiceMapTable.invoiceId, invoiceId));
  if (invoiceMap) {
    try {
      await xeroFetch(db, env, `/CreditNotes/${xeroCreditNoteId}/Allocations`, {
        method: "PUT",
        body: JSON.stringify({
          Allocations: [
            {
              Invoice: { InvoiceID: invoiceMap.xeroInvoiceId },
              Amount: invoice.subtotal + invoice.vatAmount,
            },
          ],
        }),
      });
    } catch {
      // Allocation is a nice-to-have on top of the credit note existing at
      // all - swallow and let the caller see the credit note was created.
    }
  }

  await db
    .insert(xeroCreditNoteMapTable)
    .values({ invoiceId, xeroCreditNoteId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: xeroCreditNoteMapTable.invoiceId,
      set: { xeroCreditNoteId, syncedAt: new Date() },
    });

  return { invoiceId, xeroCreditNoteId };
}

export async function syncAllCreditNotes(db: Database, env: Bindings) {
  const credited = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.status, "credited"));
  return Promise.all(
    credited.map((inv) =>
      syncCreditNote(db, env, inv.id).catch((e) => ({
        error: String(e),
        invoiceId: inv.id,
      })),
    ),
  );
}

// ─── Chart of accounts ───────────────────────────────────────────────────────

export async function fetchAccounts(db: Database, env: Bindings) {
  const r = (await xeroFetch(db, env, "/Accounts")) as {
    Accounts?: Array<{
      AccountID: string;
      Code?: string;
      Name: string;
      Type: string;
      Class: string;
      Status: string;
    }>;
  };
  return (r.Accounts ?? [])
    .filter((a) => a.Status === "ACTIVE" && a.Code)
    .map((a) => ({
      code: a.Code as string,
      name: a.Name,
      type: a.Type,
      class: a.Class,
    }));
}
