import {
  db,
  xeroConnectionTable,
  xeroClientMapTable,
  xeroInvoiceMapTable,
  xeroQuoteMapTable,
  clientsTable,
  invoicesTable,
  quotesTable,
  lineItemsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const XERO_API = "https://api.xero.com/api.xro/2.0";

// ─── Credentials ────────────────────────────────────────────────────────────

function creds() {
  const id = process.env.XERO_CLIENT_ID;
  const secret = process.env.XERO_CLIENT_SECRET;
  if (!id || !secret)
    throw new Error("XERO_CLIENT_ID / XERO_CLIENT_SECRET not configured");
  return { id, secret };
}

function basicAuth() {
  const { id, secret } = creds();
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

// ─── Connection helpers ──────────────────────────────────────────────────────

export async function getConnection() {
  const [conn] = await db.select().from(xeroConnectionTable).limit(1);
  return conn ?? null;
}

let refreshInFlight: Promise<typeof xeroConnectionTable.$inferSelect> | null =
  null;

async function refreshIfNeeded(conn: typeof xeroConnectionTable.$inferSelect) {
  // Refresh 5 min before expiry
  if (Date.now() < new Date(conn.expiresAt).getTime() - 5 * 60 * 1000)
    return conn;

  // Concurrent requests hitting an expired token share one refresh instead of
  // racing each other and clobbering the stored refresh token.
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh(conn).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(conn: typeof xeroConnectionTable.$inferSelect) {
  const r = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
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

async function xeroFetch(path: string, opts: RequestInit = {}) {
  const conn = await getConnection();
  if (!conn) throw new Error("Xero not connected");
  const fresh = await refreshIfNeeded(conn);

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

export function buildAuthUrl(state: string) {
  const { id } = creds();
  const redirectUri = process.env.XERO_REDIRECT_URI;
  if (!redirectUri) throw new Error("XERO_REDIRECT_URI not configured");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: id,
    redirect_uri: redirectUri,
    scope:
      "openid profile email accounting.contacts accounting.transactions offline_access",
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${params}`;
}

export async function exchangeCode(code: string) {
  const redirectUri = process.env.XERO_REDIRECT_URI;
  if (!redirectUri) throw new Error("XERO_REDIRECT_URI not configured");
  const r = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
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

export async function disconnect() {
  await db.delete(xeroConnectionTable);
  await db.delete(xeroClientMapTable);
  await db.delete(xeroInvoiceMapTable);
  await db.delete(xeroQuoteMapTable);
}

// ─── Contact sync ─────────────────────────────────────────────────────────────

export async function syncContact(clientId: string) {
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

  const r = (await xeroFetch("/Contacts", {
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

export async function syncAllContacts() {
  const clients = await db.select().from(clientsTable);
  return Promise.all(
    clients.map((c) =>
      syncContact(c.id).catch((e) => ({ error: String(e), clientId: c.id })),
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

async function ensureContact(clientId: string | null) {
  if (!clientId) return undefined;
  const [map] = await db
    .select()
    .from(xeroClientMapTable)
    .where(eq(xeroClientMapTable.clientId, clientId));
  if (map) return map.xeroContactId;
  const r = await syncContact(clientId);
  return r.xeroContactId;
}

export async function syncInvoice(invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId));
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const xeroContactId = await ensureContact(invoice.clientId);

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
    LineAmountTypes: "EXCLUSIVE",
    LineItems: [
      {
        Description: `Construction services — ${invoice.invoiceNumber}`,
        Quantity: 1,
        UnitAmount: invoice.subtotal,
        TaxType: invoice.vatAmount > 0 ? "OUTPUT2" : "NONE",
        TaxAmount: invoice.vatAmount,
        LineAmount: invoice.subtotal,
      },
    ],
  };

  if (xeroContactId) xeroInvoice.Contact = { ContactID: xeroContactId };
  if (existingMap) xeroInvoice.InvoiceID = existingMap.xeroInvoiceId;
  if (invoice.notes) xeroInvoice.Reference = invoice.notes;
  if (invoice.cisDeduction && invoice.cisDeduction > 0) {
    xeroInvoice.CISDeduction = invoice.cisDeduction;
  }

  const r = (await xeroFetch("/Invoices", {
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

export async function syncAllInvoices() {
  const invoices = await db.select().from(invoicesTable);
  return Promise.all(
    invoices.map((inv) =>
      syncInvoice(inv.id).catch((e) => ({
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

export async function syncQuote(quoteId: string) {
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.id, quoteId));
  if (!quote) throw new Error(`Quote ${quoteId} not found`);

  const lineItems = await db
    .select()
    .from(lineItemsTable)
    .where(eq(lineItemsTable.quoteId, quoteId));

  const xeroContactId = await ensureContact(quote.clientId);

  const [existingMap] = await db
    .select()
    .from(xeroQuoteMapTable)
    .where(eq(xeroQuoteMapTable.quoteId, quoteId));

  const xeroQuote: Record<string, unknown> = {
    QuoteNumber: quote.quoteNumber,
    Status: QUOTE_STATUS[quote.status] ?? "DRAFT",
    Date: quote.createdAt.toISOString().slice(0, 10),
    LineAmountTypes: "EXCLUSIVE",
    LineItems:
      lineItems.length > 0
        ? lineItems.map((li) => ({
            Description: li.description,
            Quantity: li.quantity,
            UnitAmount: li.unitPrice,
            TaxType: "OUTPUT2",
            LineAmount: li.total,
          }))
        : [
            {
              Description: quote.title ?? `Quote ${quote.quoteNumber}`,
              Quantity: 1,
              UnitAmount: quote.subtotal,
              TaxType: "OUTPUT2",
              LineAmount: quote.subtotal,
            },
          ],
  };

  if (xeroContactId) xeroQuote.Contact = { ContactID: xeroContactId };
  if (existingMap) xeroQuote.QuoteID = existingMap.xeroQuoteId;
  if (quote.title) xeroQuote.Title = quote.title;
  if (quote.validUntil) xeroQuote.ExpiryDate = quote.validUntil;
  if (quote.notes) xeroQuote.Summary = quote.notes;

  const r = (await xeroFetch("/Quotes", {
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

export async function syncAllQuotes() {
  const quotes = await db.select().from(quotesTable);
  return Promise.all(
    quotes.map((q) =>
      syncQuote(q.id).catch((e) => ({ error: String(e), quoteId: q.id })),
    ),
  );
}

// ─── Pull payments from Xero ─────────────────────────────────────────────────

export async function pullPayments() {
  const r = (await xeroFetch("/Invoices?Statuses=PAID&Type=ACCREC")) as {
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
