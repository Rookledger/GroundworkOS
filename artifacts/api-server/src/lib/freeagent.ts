import {
  db,
  freeagentConnectionTable,
  freeagentClientMapTable,
  freeagentInvoiceMapTable,
  freeagentQuoteMapTable,
  clientsTable,
  invoicesTable,
  quotesTable,
  lineItemsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const FA_AUTH_URL = "https://api.freeagent.com/v2/approve_app";
const FA_TOKEN_URL = "https://api.freeagent.com/v2/token_endpoint";
const FA_API_BASE = "https://api.freeagent.com/v2";

// ─── Credentials ────────────────────────────────────────────────────────────

function creds() {
  const id = process.env.FREEAGENT_CLIENT_ID;
  const secret = process.env.FREEAGENT_CLIENT_SECRET;
  if (!id || !secret)
    throw new Error(
      "FREEAGENT_CLIENT_ID / FREEAGENT_CLIENT_SECRET not configured",
    );
  return { id, secret };
}

function basicAuth() {
  const { id, secret } = creds();
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

// ─── Connection helpers ──────────────────────────────────────────────────────

export async function getConnection() {
  const [conn] = await db.select().from(freeagentConnectionTable).limit(1);
  return conn ?? null;
}

let refreshInFlight: Promise<
  typeof freeagentConnectionTable.$inferSelect
> | null = null;

async function refreshIfNeeded(
  conn: typeof freeagentConnectionTable.$inferSelect,
) {
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

async function doRefresh(conn: typeof freeagentConnectionTable.$inferSelect) {
  const r = await fetch(FA_TOKEN_URL, {
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
    throw new Error(
      `FreeAgent token refresh failed: ${r.status} ${await r.text()}`,
    );

  const t = (await r.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const expiresAt = new Date(Date.now() + t.expires_in * 1000);
  const updatedAt = new Date();

  const [updated] = await db
    .update(freeagentConnectionTable)
    .set({
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt,
      updatedAt,
    })
    .where(eq(freeagentConnectionTable.id, conn.id))
    .returning();
  return updated;
}

async function faFetch(path: string, opts: RequestInit = {}) {
  const conn = await getConnection();
  if (!conn) throw new Error("FreeAgent not connected");
  const fresh = await refreshIfNeeded(conn);

  const url = `${FA_API_BASE}${path}`;
  const r = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
  if (!r.ok) throw new Error(`FreeAgent API ${r.status}: ${await r.text()}`);
  return r.json() as Promise<Record<string, unknown>>;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string) {
  const { id } = creds();
  const redirectUri = process.env.FREEAGENT_REDIRECT_URI;
  if (!redirectUri) throw new Error("FREEAGENT_REDIRECT_URI not configured");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: id,
    redirect_uri: redirectUri,
    state,
  });
  return `${FA_AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string) {
  const redirectUri = process.env.FREEAGENT_REDIRECT_URI;
  if (!redirectUri) throw new Error("FREEAGENT_REDIRECT_URI not configured");
  const r = await fetch(FA_TOKEN_URL, {
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
      `FreeAgent auth code exchange failed: ${r.status} ${await r.text()}`,
    );
  return r.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function fetchCompanyName(accessToken: string) {
  const r = await fetch(`${FA_API_BASE}/company`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { company?: { name?: string } };
  return data.company?.name ?? null;
}

export async function storeConnection(
  tokens: { access_token: string; refresh_token: string; expires_in: number },
  companyName: string | null,
) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await db.delete(freeagentConnectionTable);
  await db.insert(freeagentConnectionTable).values({
    id: "singleton",
    companyName,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    connectedAt: now,
    updatedAt: now,
  });
}

export async function disconnect() {
  await db.delete(freeagentConnectionTable);
  await db.delete(freeagentClientMapTable);
  await db.delete(freeagentInvoiceMapTable);
  await db.delete(freeagentQuoteMapTable);
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
    .from(freeagentClientMapTable)
    .where(eq(freeagentClientMapTable.clientId, clientId));

  const contact: Record<string, unknown> = {
    organisation_name: client.companyName,
  };
  if (client.email) contact.email = client.email;
  if (client.phone) contact.phone_number = client.phone;
  if (client.address) contact.address1 = client.address;

  const method = existing ? "PUT" : "POST";
  const path = existing
    ? `/contacts/${existing.freeagentContactId}`
    : "/contacts";

  const r = (await faFetch(path, {
    method,
    body: JSON.stringify({ contact }),
  })) as { contact?: { url?: string } };

  const freeagentContactId =
    r.contact?.url?.split("/").pop() ?? existing?.freeagentContactId;
  if (!freeagentContactId)
    throw new Error("No contact id returned from FreeAgent");

  await db
    .insert(freeagentClientMapTable)
    .values({ clientId, freeagentContactId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: freeagentClientMapTable.clientId,
      set: { freeagentContactId, syncedAt: new Date() },
    });

  return { clientId, freeagentContactId };
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
    .from(freeagentClientMapTable)
    .where(eq(freeagentClientMapTable.clientId, clientId));
  if (map) return map.freeagentContactId;
  const r = await syncContact(clientId);
  return r.freeagentContactId;
}

export async function syncInvoice(invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId));
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const freeagentContactId = await ensureContact(invoice.clientId);
  if (!freeagentContactId)
    throw new Error("Invoice has no client to bill in FreeAgent");

  const [existingMap] = await db
    .select()
    .from(freeagentInvoiceMapTable)
    .where(eq(freeagentInvoiceMapTable.invoiceId, invoiceId));

  const faInvoice: Record<string, unknown> = {
    contact: `${FA_API_BASE}/contacts/${freeagentContactId}`,
    dated_on: invoice.issuedDate,
    due_on: invoice.dueDate ?? invoice.issuedDate,
    reference: invoice.invoiceNumber,
    invoice_items: [
      {
        description: `Construction services — ${invoice.invoiceNumber}`,
        quantity: 1,
        price: invoice.subtotal,
        item_type: "Services",
      },
    ],
  };
  if (invoice.notes) faInvoice.comments = invoice.notes;

  const method = existingMap ? "PUT" : "POST";
  const path = existingMap
    ? `/invoices/${existingMap.freeagentInvoiceId}`
    : "/invoices";

  const r = (await faFetch(path, {
    method,
    body: JSON.stringify({ invoice: faInvoice }),
  })) as { invoice?: { url?: string } };

  const freeagentInvoiceId =
    r.invoice?.url?.split("/").pop() ?? existingMap?.freeagentInvoiceId;
  if (!freeagentInvoiceId)
    throw new Error("No invoice id returned from FreeAgent");

  await db
    .insert(freeagentInvoiceMapTable)
    .values({ invoiceId, freeagentInvoiceId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: freeagentInvoiceMapTable.invoiceId,
      set: { freeagentInvoiceId, syncedAt: new Date() },
    });

  return { invoiceId, freeagentInvoiceId };
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

// ─── Quote (Estimate) sync ─────────────────────────────────────────────────────

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

  const freeagentContactId = await ensureContact(quote.clientId);
  if (!freeagentContactId)
    throw new Error("Quote has no client to bill in FreeAgent");

  const [existingMap] = await db
    .select()
    .from(freeagentQuoteMapTable)
    .where(eq(freeagentQuoteMapTable.quoteId, quoteId));

  const items =
    lineItems.length > 0
      ? lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          price: li.unitPrice,
          item_type: "Services",
        }))
      : [
          {
            description: quote.title ?? `Quote ${quote.quoteNumber}`,
            quantity: 1,
            price: quote.subtotal,
            item_type: "Services",
          },
        ];

  const faEstimate: Record<string, unknown> = {
    contact: `${FA_API_BASE}/contacts/${freeagentContactId}`,
    dated_on: quote.createdAt.toISOString().slice(0, 10),
    reference: quote.quoteNumber,
    estimate_items: items,
  };
  if (quote.notes) faEstimate.comments = quote.notes;

  const method = existingMap ? "PUT" : "POST";
  const path = existingMap
    ? `/estimates/${existingMap.freeagentEstimateId}`
    : "/estimates";

  const r = (await faFetch(path, {
    method,
    body: JSON.stringify({ estimate: faEstimate }),
  })) as { estimate?: { url?: string } };

  const freeagentEstimateId =
    r.estimate?.url?.split("/").pop() ?? existingMap?.freeagentEstimateId;
  if (!freeagentEstimateId)
    throw new Error("No estimate id returned from FreeAgent");

  await db
    .insert(freeagentQuoteMapTable)
    .values({ quoteId, freeagentEstimateId, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: freeagentQuoteMapTable.quoteId,
      set: { freeagentEstimateId, syncedAt: new Date() },
    });

  return { quoteId, freeagentEstimateId };
}

export async function syncAllQuotes() {
  const quotes = await db.select().from(quotesTable);
  return Promise.all(
    quotes.map((q) =>
      syncQuote(q.id).catch((e) => ({ error: String(e), quoteId: q.id })),
    ),
  );
}

// ─── Pull payments from FreeAgent ────────────────────────────────────────────

export async function pullPayments() {
  const maps = await db.select().from(freeagentInvoiceMapTable);
  let updated = 0;

  for (const { invoiceId, freeagentInvoiceId } of maps) {
    const r = (await faFetch(`/invoices/${freeagentInvoiceId}`)) as {
      invoice?: { status?: string };
    };
    if (r.invoice?.status !== "Paid") continue;

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
