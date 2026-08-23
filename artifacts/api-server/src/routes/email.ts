import { Router } from "express";
import {
  db,
  quotesTable,
  invoicesTable,
  companySettingsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth.js";
import { logAudit } from "./audit.js";

const router = Router();

async function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const { Resend } = await import("resend");
  return new Resend(apiKey);
}

function buildQuoteHtml(quote: any, company: any): string {
  const lines = (quote.lineItems ?? [])
    .map(
      (l: any) =>
        `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e4dd;">${l.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e4dd;text-align:right;">${l.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e4dd;text-align:right;">£${Number(l.unit_price ?? l.unitPrice ?? 0).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e4dd;text-align:right;">£${Number(l.total ?? l.quantity * (l.unit_price ?? l.unitPrice ?? 0)).toFixed(2)}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#f0ede8;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fafaf8;border-radius:12px;overflow:hidden;border:1px solid #d9d4ce;">
    <div style="background:#1b5e78;padding:28px 32px;">
      <div style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:22px;color:#ffffff;letter-spacing:-0.02em;">
        ${company.companyName ?? "Your Company"}
      </div>
      <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">Quote ${quote.quoteNumber}</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#4a4540;font-size:14px;line-height:1.7;margin-top:0;">
        Please find your quote attached below. If you have any questions, please don't hesitate to get in touch.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <thead>
          <tr style="background:#f0ede8;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#7a7469;">Description</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#7a7469;">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#7a7469;">Unit</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#7a7469;">Total</th>
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <div style="margin-top:16px;padding-top:16px;border-top:2px solid #d9d4ce;text-align:right;">
        <div style="font-size:12px;color:#7a7469;margin-bottom:4px;">Subtotal: £${Number(quote.subtotal ?? 0).toFixed(2)}</div>
        <div style="font-size:12px;color:#7a7469;margin-bottom:4px;">VAT (20%): £${Number(quote.vatAmount ?? 0).toFixed(2)}</div>
        <div style="font-size:18px;font-weight:700;color:#1b5e78;">Total: £${Number(quote.totalAmount ?? 0).toFixed(2)}</div>
      </div>
      ${quote.notes ? `<div style="margin-top:20px;padding:12px 16px;background:#f0ede8;border-radius:8px;font-size:13px;color:#4a4540;">${quote.notes}</div>` : ""}
    </div>
    <div style="background:#f0ede8;padding:16px 32px;font-size:11px;color:#a8a099;text-align:center;">
      ${[company.companyName, company.email, company.phone, company.address].filter(Boolean).join(" · ")}
    </div>
  </div>
</body>
</html>`;
}

function buildInvoiceHtml(invoice: any, company: any): string {
  const lines = (invoice.lineItems ?? [])
    .map(
      (l: any) =>
        `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e4dd;">${l.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e4dd;text-align:right;">${l.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e4dd;text-align:right;">£${Number(l.unit_price ?? l.unitPrice ?? 0).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e4dd;text-align:right;">£${Number(l.total ?? l.quantity * (l.unit_price ?? l.unitPrice ?? 0)).toFixed(2)}</td>
    </tr>`,
    )
    .join("");

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#f0ede8;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fafaf8;border-radius:12px;overflow:hidden;border:1px solid #d9d4ce;">
    <div style="background:#1b5e78;padding:28px 32px;">
      <div style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:22px;color:#ffffff;letter-spacing:-0.02em;">
        ${company.companyName ?? "Your Company"}
      </div>
      <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">Invoice ${invoice.invoiceNumber}</div>
    </div>
    <div style="padding:28px 32px;">
      ${
        dueDate
          ? `<div style="background:#fff8e6;border:1px solid #f0d080;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#92400e;">
        <strong>Payment due: ${dueDate}</strong>
      </div>`
          : ""
      }
      <p style="color:#4a4540;font-size:14px;line-height:1.7;margin-top:0;">
        Please find your invoice below. Payment details are included at the bottom of this email.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <thead>
          <tr style="background:#f0ede8;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#7a7469;">Description</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#7a7469;">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#7a7469;">Unit</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#7a7469;">Total</th>
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <div style="margin-top:16px;padding-top:16px;border-top:2px solid #d9d4ce;text-align:right;">
        <div style="font-size:12px;color:#7a7469;margin-bottom:4px;">Subtotal: £${Number(invoice.subtotal ?? 0).toFixed(2)}</div>
        <div style="font-size:12px;color:#7a7469;margin-bottom:4px;">VAT (20%): £${Number(invoice.vatAmount ?? 0).toFixed(2)}</div>
        ${invoice.cisDeduction ? `<div style="font-size:12px;color:#7a7469;margin-bottom:4px;">CIS Deduction: -£${Number(invoice.cisDeduction).toFixed(2)}</div>` : ""}
        <div style="font-size:18px;font-weight:700;color:#1b5e78;">Total Due: £${Number(invoice.totalAmount ?? 0).toFixed(2)}</div>
      </div>
      ${company.bankDetails ? `<div style="margin-top:20px;padding:12px 16px;background:#f0ede8;border-radius:8px;font-size:13px;color:#4a4540;white-space:pre-line;">${company.bankDetails}</div>` : ""}
    </div>
    <div style="background:#f0ede8;padding:16px 32px;font-size:11px;color:#a8a099;text-align:center;">
      ${[company.companyName, company.email, company.phone, company.address].filter(Boolean).join(" · ")}
    </div>
  </div>
</body>
</html>`;
}

router.post("/email/send-quote", requireRole("manager"), async (req, res) => {
  const { quoteId, to, subject } = req.body as {
    quoteId: string;
    to: string;
    subject?: string;
  };
  if (!quoteId || !to)
    return res.status(400).json({ error: "quoteId and to are required" });

  const resend = await getResend();
  if (!resend)
    return res
      .status(503)
      .json({ error: "Email not configured — add RESEND_API_KEY to secrets" });

  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.id, quoteId));
  if (!quote) return res.status(404).json({ error: "Quote not found" });

  const [settings] = await db.select().from(companySettingsTable).limit(1);
  const company = settings ?? {};

  const fromEmail = (company as any).email
    ? `${(company as any).companyName ?? "GroundworkOS"} <onboarding@resend.dev>`
    : "onboarding@resend.dev";

  const html = buildQuoteHtml(quote, company);

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject:
        subject ??
        `Quote ${quote.quoteNumber} from ${(company as any).companyName ?? "GroundworkOS"}`,
      html,
    });

    await db
      .update(quotesTable)
      .set({ status: "sent", sentAt: new Date().toISOString() } as any)
      .where(eq(quotesTable.id, quoteId));
    await logAudit(
      "quote",
      quoteId,
      "update",
      { action: "email_sent", to },
      req,
    );

    return res.json({ ok: true });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message ?? "Failed to send email" });
  }
});

router.post("/email/send-invoice", requireRole("manager"), async (req, res) => {
  const { invoiceId, to, subject } = req.body as {
    invoiceId: string;
    to: string;
    subject?: string;
  };
  if (!invoiceId || !to)
    return res.status(400).json({ error: "invoiceId and to are required" });

  const resend = await getResend();
  if (!resend)
    return res
      .status(503)
      .json({ error: "Email not configured — add RESEND_API_KEY to secrets" });

  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId));
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  const [settings] = await db.select().from(companySettingsTable).limit(1);
  const company = settings ?? {};

  const fromEmail = (company as any).email
    ? `${(company as any).companyName ?? "GroundworkOS"} <onboarding@resend.dev>`
    : "onboarding@resend.dev";

  const html = buildInvoiceHtml(invoice, company);

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject:
        subject ??
        `Invoice ${invoice.invoiceNumber} from ${(company as any).companyName ?? "GroundworkOS"}`,
      html,
    });

    await db
      .update(invoicesTable)
      .set({ status: "sent" } as any)
      .where(eq(invoicesTable.id, invoiceId));
    await logAudit(
      "invoice",
      invoiceId,
      "update",
      { action: "email_sent", to },
      req,
    );

    return res.json({ ok: true });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message ?? "Failed to send email" });
  }
});

export default router;
