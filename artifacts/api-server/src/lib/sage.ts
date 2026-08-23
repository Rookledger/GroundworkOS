import {
  db,
  sageConnectionTable,
  sageClientMapTable,
  sageInvoiceMapTable,
  sageQuoteMapTable,
  clientsTable,
  invoicesTable,
  quotesTable,
  lineItemsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const SAGE_AUTH_URL = "https://www.sageone.com/oauth2/auth/central";
const SAGE_TOKEN_URL = "https://oauth.accounting.sage.com/token";
const SAGE_API_BASE = "https://api.accounting.sage.com/v3.1";

// ─── Credentials ────────────────────────────────────────────────────────────

function creds() {
  const id = process.env.SAGE_CLIENT_ID;
  const secret = process.env.SAGE_CLIENT_SECRET;
  if (!id || !secret)
    throw new Error("SAGE_CLIENT_ID / SAGE_CLIENT_SECRET not configured");
  return { id, secret };
}

// ─── Connection helpers ──────────────────────────────────────────────────────

export async function getConnection() {
  const [conn] = await db.select().from(sageConnectionTable).limit(1);
  return conn ?? null;
}

let refreshInFlight: Promise<typeof sageConnectionTable.$inferSelect> | null =
  null;

async function refreshIfNeeded(conn: typeof sageConnectionTable.$inferSelect) {
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

async function doRefresh(conn: typeof sageConnectionTable.$inferSelect) {
  const { id, secret } = creds();
  const r = await fetch(SAGE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!r.ok)
    throw new Error(`Sage token refresh failed: ${r.status} ${await r.text()}`);

  const t = (await r.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const expiresAt = new Date(Date.now() + t.expires_in * 1000);
  const updatedAt = new Date();

  const [updated] = await db
    .update(sageConnectionTable)
    .set({
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt,
      updatedAt,
    })
    .where(eq(sageConnectionTable.id, conn.id))
    .returning();
  return updated;
}

async function sageFetch(path: string, opts: RequestInit = {}) {
  const conn = await getConnection();
  if (!conn) throw new Error("Sage not connected");
  const fresh = await refreshIfNeeded(conn);

  const url = `${SAGE_API_BASE}${path}`;
  const r = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
  if (!r.ok) throw new Error(`Sage API ${r.status}: ${await r.text()}`);
  return r.json() as Promise<Record<string, unknown>>;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string) {
  const { id } = creds();
  const redirectUri = process.env.SAGE_REDIRECT_URI;
  if (!redirectUri) throw new Error("SAGE_REDIRECT_URI not configured");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: id,
    redirect_uri: redirectUri,
    scope: "full_access",
    filter: "apiv3.1",
    state,
  });
  return `${SAGE_AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string) {
  const { id, secret } = creds();
  const redirectUri = process.env.SAGE_REDIRECT_URI;
  if (!redirectUri) throw new Error("SAGE_REDIRECT_URI not configured");
  const r = await fetch(SAGE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!r.ok)
    throw new Error(
      `Sage auth code exchange failed: ${r.status} ${await r.text()}`,
    );
  return r.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function fetchBusiness(accessToken: string) {
  const r = await fetch(`${SAGE_API_BASE}/business`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!r.ok) throw new Error(`Failed to fetch Sage business: ${r.status}`);
  const data = (await r.json()) as {
    $items?: Array<{ id: string; name?: string }>;
  };
  const first = data.$items?.[0];
  if (!first) throw new Error("No Sage business found for this account.");
  return { businessId: first.id, businessName: first.name ?? null };
}

export async function storeConnection(
  tokens: { access_token: string; refresh_token: string; expires_in: number },
  businessId: string,
  businessName: string | null,
) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await db.delete(sageConnectionTable);
  await db.insert(sageConnectionTable).values({
    id: "singleton",
    businessId,
    businessName,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    connectedAt: now,
    updatedAt: now,
  });
}

export async function disconnect() {
  await db.delete(sageConnectionTable);
  await db.delete(sageClientMapTable);
  await db.delete(sageInvoiceMapTable);
  await db.delete(sageQuoteMapTable);
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
    .from(sageClientMapTable)
    .where(eq(sageClientMapTable.clientId, clientId));

  const contact: Record<string, unknown> = {
    name: client.companyName,
    contact_type_ids: ["CUSTOMER"],
  };
  if (client.email) contact.main_contact_person = { email: client.email };

  const method = existing ? "PUT" : "POST";
  const path = existing ? `/contacts/${existing.sageContactId}` : "/contacts";

  const r = (await sageFetch(path, {
    method,
    body: JSON.stringify({ contact }),
  })) as { id?: string; contact?: { id?: string } };

  const sageContactId = r.id ?? r.contact?.id ?? existing?.sageContactId;
  if (!sageContactId) throw new Error("No contact id returned from Sage");

  await db
    .insert(sageClientMapTable)
    .values({ clientId, sageContactId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: sageClientMapTable.clientId,
      set: { sageContactId, syncedAt: new Date() },
    });

  return { clientId, sageContactId };
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

async function ensureContact(clientId: string | null) {
  if (!clientId) return undefined;
  const [map] = await db
    .select()
    .from(sageClientMapTable)
    .where(eq(sageClientMapTable.clientId, clientId));
  if (map) return map.sageContactId;
  const r = await syncContact(clientId);
  return r.sageContactId;
}

export async function syncInvoice(invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId));
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const sageContactId = await ensureContact(invoice.clientId);
  if (!sageContactId) throw new Error("Invoice has no client to bill in Sage");

  const [existingMap] = await db
    .select()
    .from(sageInvoiceMapTable)
    .where(eq(sageInvoiceMapTable.invoiceId, invoiceId));

  const salesInvoice: Record<string, unknown> = {
    contact_id: sageContactId,
    date: invoice.issuedDate,
    due_date: invoice.dueDate ?? invoice.issuedDate,
    reference: invoice.invoiceNumber,
    invoice_lines: [
      {
        description: `Construction services — ${invoice.invoiceNumber}`,
        quantity: 1,
        unit_price: invoice.subtotal,
        tax_rate_id: invoice.vatAmount > 0 ? "GB_STANDARD" : "GB_ZERO",
      },
    ],
  };
  if (invoice.notes) salesInvoice.notes = invoice.notes;

  const method = existingMap ? "PUT" : "POST";
  const path = existingMap
    ? `/sales_invoices/${existingMap.sageInvoiceId}`
    : "/sales_invoices";

  const r = (await sageFetch(path, {
    method,
    body: JSON.stringify({ sales_invoice: salesInvoice }),
  })) as { id?: string; sales_invoice?: { id?: string } };

  const sageInvoiceId =
    r.id ?? r.sales_invoice?.id ?? existingMap?.sageInvoiceId;
  if (!sageInvoiceId) throw new Error("No invoice id returned from Sage");

  await db
    .insert(sageInvoiceMapTable)
    .values({ invoiceId, sageInvoiceId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: sageInvoiceMapTable.invoiceId,
      set: { sageInvoiceId, syncedAt: new Date() },
    });

  return { invoiceId, sageInvoiceId };
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

  const sageContactId = await ensureContact(quote.clientId);
  if (!sageContactId) throw new Error("Quote has no client to bill in Sage");

  const [existingMap] = await db
    .select()
    .from(sageQuoteMapTable)
    .where(eq(sageQuoteMapTable.quoteId, quoteId));

  const lines =
    lineItems.length > 0
      ? lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unitPrice,
        }))
      : [
          {
            description: quote.title ?? `Quote ${quote.quoteNumber}`,
            quantity: 1,
            unit_price: quote.subtotal,
          },
        ];

  const sageQuote: Record<string, unknown> = {
    contact_id: sageContactId,
    date: quote.createdAt.toISOString().slice(0, 10),
    reference: quote.quoteNumber,
    quote_lines: lines,
  };
  if (quote.notes) sageQuote.notes = quote.notes;
  if (quote.validUntil) sageQuote.valid_until_date = quote.validUntil;

  const method = existingMap ? "PUT" : "POST";
  const path = existingMap ? `/quotes/${existingMap.sageQuoteId}` : "/quotes";

  const r = (await sageFetch(path, {
    method,
    body: JSON.stringify({ quote: sageQuote }),
  })) as { id?: string; quote?: { id?: string } };

  const sageQuoteId = r.id ?? r.quote?.id ?? existingMap?.sageQuoteId;
  if (!sageQuoteId) throw new Error("No quote id returned from Sage");

  await db
    .insert(sageQuoteMapTable)
    .values({ quoteId, sageQuoteId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: sageQuoteMapTable.quoteId,
      set: { sageQuoteId, syncedAt: new Date() },
    });

  return { quoteId, sageQuoteId };
}

export async function syncAllQuotes() {
  const quotes = await db.select().from(quotesTable);
  return Promise.all(
    quotes.map((q) =>
      syncQuote(q.id).catch((e) => ({ error: String(e), quoteId: q.id })),
    ),
  );
}

// ─── Pull payments from Sage ─────────────────────────────────────────────────

export async function pullPayments() {
  const maps = await db.select().from(sageInvoiceMapTable);
  let updated = 0;

  for (const { invoiceId, sageInvoiceId } of maps) {
    const r = (await sageFetch(`/sales_invoices/${sageInvoiceId}`)) as {
      sales_invoice?: { status?: { id?: string } };
    };
    const statusId = r.sales_invoice?.status?.id;
    if (statusId !== "PAID") continue;

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
