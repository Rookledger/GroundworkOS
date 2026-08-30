import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle, XCircle, FileText, Building2 } from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Btn } from "../components/ui/Btn";
import { CornerMarks } from "../components/ui/Blueprint";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface PortalQuote {
  id: string;
  quoteNumber: string;
  title: string | null;
  status: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  validUntil: string | null;
  notes: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  lineItems: LineItem[];
  client: {
    companyName: string;
    email: string | null;
    address: string | null;
  } | null;
  company: {
    name: string;
    address: string;
    vatNumber: string;
    phone: string;
    email: string;
  };
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting response",
  approved: "Approved",
  accepted: "Approved",
  declined: "Declined",
  expired: "Expired",
};

function scrollToDetail() {
  document
    .getElementById("quote-detail")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<PortalQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approverName, setApproverName] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "decline" | null>(
    null,
  );
  const [outcome, setOutcome] = useState<"approved" | "declined" | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/portal/${token}`)
      .then((r) =>
        r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error)),
      )
      .then(setQuote)
      .catch((e: any) =>
        setError(typeof e === "string" ? e : "Quote not found"),
      )
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAction(action: "approve" | "decline") {
    if (action === "approve" && !approverName.trim()) return;
    setSubmitting(action);
    try {
      const r = await fetch(`${BASE}/api/portal/${token}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: approverName }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error);
      }
      setOutcome(action === "approve" ? "approved" : "declined");
      setQuote((prev) =>
        prev
          ? { ...prev, status: action === "approve" ? "accepted" : "declined" }
          : prev,
      );
    } catch (e: any) {
      alert(e.message ?? "Something went wrong");
    } finally {
      setSubmitting(null);
    }
  }

  const brandMark = (
    <span
      className="flex-shrink-0"
      style={{
        width: 22,
        height: 22,
        background:
          "repeating-linear-gradient(135deg,#f0a11e 0 4px,#1d2d3d 4px 8px)",
        border: "1px solid rgba(255,255,255,.35)",
      }}
    />
  );

  const header = (
    <header style={{ backgroundColor: "var(--ink-navy)" }}>
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "0 24px",
          minHeight: 60,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {brandMark}
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 15,
            color: "#ffffff",
            letterSpacing: "0.02em",
          }}
        >
          GROUNDWORK<span style={{ color: "var(--amber)" }}>OS</span>
        </span>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 9px",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#ffffff",
            backgroundColor: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        >
          Read only
        </span>
      </div>
    </header>
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg)" }}>
        {header}
        <div
          style={{
            minHeight: "calc(100dvh - 60px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--muted)",
              fontSize: 14,
            }}
          >
            Loading quote…
          </div>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg)" }}>
        {header}
        <div
          style={{
            minHeight: "calc(100dvh - 60px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <XCircle
              strokeWidth={1.5}
              style={{
                width: 40,
                height: 40,
                color: "var(--danger)",
                margin: "0 auto 12px",
              }}
            />
            <p
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: 16,
                color: "var(--ink)",
              }}
            >
              Quote not found
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--muted)",
                marginTop: 4,
              }}
            >
              {error ?? "This link may have expired."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isResolved = quote.status === "approved" || quote.status === "declined";
  const resolvedByAction = outcome;
  const needsAction = !isResolved && quote.status === "sent";
  const statusLabel = STATUS_LABELS[quote.status] ?? quote.status;

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--bg)" }}>
      {header}

      <div
        style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px 64px" }}
      >
        {resolvedByAction && (
          <div
            className="blueprint relative"
            style={{
              marginBottom: 24,
              padding: "16px 20px",
              border: `1px solid ${resolvedByAction === "approved" ? "rgba(42,110,69,0.3)" : "rgba(178,58,38,0.3)"}`,
              backgroundColor:
                resolvedByAction === "approved"
                  ? "var(--success-bg)"
                  : "var(--danger-bg)",
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <CornerMarks />
            {resolvedByAction === "approved" ? (
              <CheckCircle
                strokeWidth={1.5}
                style={{
                  width: 20,
                  height: 20,
                  color: "var(--success)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <XCircle
                strokeWidth={1.5}
                style={{
                  width: 20,
                  height: 20,
                  color: "var(--danger)",
                  flexShrink: 0,
                }}
              />
            )}
            <div>
              <p
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 14,
                  color:
                    resolvedByAction === "approved"
                      ? "var(--success)"
                      : "var(--danger)",
                }}
              >
                {resolvedByAction === "approved"
                  ? "Quote approved — thank you!"
                  : "Quote declined"}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--muted)",
                  marginTop: 2,
                }}
              >
                {resolvedByAction === "approved"
                  ? `Approved by ${approverName}. We'll be in touch to confirm next steps.`
                  : "We'll be in touch if you'd like to discuss further."}
              </p>
            </div>
          </div>
        )}

        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          style={{ marginBottom: 24 }}
        >
          <StatCard label="Quote value" value={fmt(quote.totalAmount)} />
          <StatCard label="Line items" value={quote.lineItems.length} />
          <StatCard
            label="Status"
            value={statusLabel}
            accent={needsAction}
          />
        </div>

        <Panel title="Shared with you" noPad className="mb-6">
          <div
            className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4"
            style={{
              backgroundColor: needsAction ? "var(--warning-bg)" : undefined,
              borderLeft: needsAction
                ? "3px solid var(--warning)"
                : "3px solid transparent",
            }}
          >
            <FileText
              strokeWidth={1.5}
              className="w-4 h-4 flex-shrink-0"
              style={{ color: needsAction ? "var(--warning-ink)" : "var(--accent)" }}
            />
            <div className="flex-1 min-w-0">
              <p
                className="truncate"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                {quote.quoteNumber} — {quote.title || "Quote"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {needsAction
                  ? "Your response is needed on this quote"
                  : `Status: ${statusLabel}`}
              </p>
            </div>
            {needsAction ? (
              <Btn size="sm" onClick={scrollToDetail} className="flex-shrink-0">
                Review
              </Btn>
            ) : (
              <button
                onClick={scrollToDetail}
                className="text-sm flex-shrink-0"
                style={{
                  color: "var(--accent)",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Open →
              </button>
            )}
          </div>
        </Panel>

        <div
          id="quote-detail"
          className="blueprint relative"
          style={{
            backgroundColor: "var(--surface)",
            overflow: "hidden",
          }}
        >
          <CornerMarks />
          <div
            style={{
              padding: "28px 32px",
              borderBottom: "1px solid var(--surface-3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                  flexWrap: "wrap",
                }}
              >
                <FileText strokeWidth={1.5} style={{ width: 16, height: 16, color: "var(--accent)" }} />
                <span
                  className="tnum"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: 12,
                    color: "var(--accent)",
                    fontWeight: 700,
                  }}
                >
                  {quote.quoteNumber}
                </span>
                <StatusBadge status={quote.status} />
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  fontSize: 22,
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {quote.title || "Quote"}
              </h1>
              {quote.validUntil && (
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--muted)",
                    marginTop: 4,
                  }}
                >
                  Valid until{" "}
                  {new Date(quote.validUntil).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  justifyContent: "flex-end",
                  marginBottom: 2,
                }}
              >
                <Building2
                  strokeWidth={1.5}
                  style={{ width: 12, height: 12, color: "var(--muted)" }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: 13,
                    color: "var(--ink)",
                  }}
                >
                  {quote.company.name}
                </span>
              </div>
              {quote.company.address && (
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {quote.company.address}
                </p>
              )}
              {quote.company.vatNumber && (
                <p
                  className="tnum"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: 11,
                    color: "var(--muted-2)",
                  }}
                >
                  VAT {quote.company.vatNumber}
                </p>
              )}
            </div>
          </div>

          {quote.client && (
            <div
              style={{
                padding: "16px 32px",
                borderBottom: "1px solid var(--surface-3)",
                backgroundColor: "var(--surface-2)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                Prepared for
              </p>
              <p
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                {quote.client.companyName}
              </p>
              {quote.client.address && (
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  {quote.client.address}
                </p>
              )}
            </div>
          )}

          <div style={{ padding: "0 32px", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--surface-3)" }}>
                  {["Description", "Qty", "Unit", "Unit Price", "Total"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 8px 10px",
                          fontFamily: "var(--font-heading)",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          textAlign: h === "Description" ? "left" : "right",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((li, i) => (
                  <tr
                    key={li.id}
                    style={{
                      borderBottom:
                        i < quote.lineItems.length - 1
                          ? "1px solid var(--bg)"
                          : "none",
                    }}
                  >
                    <td
                      style={{
                        padding: "11px 8px",
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        color: "var(--ink)",
                        textAlign: "left",
                      }}
                    >
                      {li.description}
                    </td>
                    <td
                      className="tnum"
                      style={{
                        padding: "11px 8px",
                        fontFamily: "var(--font-heading)",
                        fontSize: 12,
                        color: "var(--ink-2)",
                        textAlign: "right",
                      }}
                    >
                      {li.quantity}
                    </td>
                    <td
                      style={{
                        padding: "11px 8px",
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        color: "var(--muted)",
                        textAlign: "right",
                      }}
                    >
                      {li.unit}
                    </td>
                    <td
                      className="tnum"
                      style={{
                        padding: "11px 8px",
                        fontFamily: "var(--font-heading)",
                        fontSize: 12,
                        color: "var(--ink-2)",
                        textAlign: "right",
                      }}
                    >
                      {fmt(li.unitPrice)}
                    </td>
                    <td
                      className="tnum"
                      style={{
                        padding: "11px 8px",
                        fontFamily: "var(--font-heading)",
                        fontSize: 13,
                        color: "var(--ink)",
                        fontWeight: 600,
                        textAlign: "right",
                      }}
                    >
                      {fmt(li.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: "16px 32px 24px",
              borderTop: "1px solid var(--surface-3)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <div style={{ minWidth: 220 }}>
              <Row label="Subtotal" value={fmt(quote.subtotal)} />
              <Row label="VAT (20%)" value={fmt(quote.vatAmount)} />
              <div
                style={{
                  height: 1,
                  backgroundColor: "var(--border)",
                  margin: "8px 0",
                }}
              />
              <Row label="Total" value={fmt(quote.totalAmount)} bold />
            </div>
          </div>

          {quote.notes && (
            <div
              style={{
                padding: "16px 32px 24px",
                borderTop: "1px solid var(--surface-3)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                Notes
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--ink-2)",
                  lineHeight: 1.65,
                }}
              >
                {quote.notes}
              </p>
            </div>
          )}
        </div>

        {!isResolved && (
          <div
            className="blueprint relative"
            style={{
              marginTop: 24,
              backgroundColor: "var(--surface)",
              padding: "24px 32px",
            }}
          >
            <CornerMarks />
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: 15,
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              Respond to this quote
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--muted)",
                marginBottom: 16,
              }}
            >
              Enter your full name to approve or decline this quote.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontFamily: "var(--font-heading)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                Full name
              </label>
              <input
                type="text"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="e.g. John Smith"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid var(--border)",
                  backgroundColor: "#ffffff",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--ink)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div className="flex flex-col sm:flex-row" style={{ gap: 10 }}>
              <Btn
                variant="primary"
                disabled={!approverName.trim() || !!submitting}
                onClick={() => handleAction("approve")}
                className="justify-center"
                style={{
                  backgroundColor: "var(--success)",
                  color: "#ffffff",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                }}
              >
                <CheckCircle strokeWidth={1.5} className="w-3.5 h-3.5" />
                {submitting === "approve" ? "Approving…" : "Approve quote"}
              </Btn>
              <Btn
                variant="danger"
                disabled={!!submitting}
                onClick={() => handleAction("decline")}
                className="justify-center"
              >
                <XCircle strokeWidth={1.5} className="w-3.5 h-3.5" />
                {submitting === "decline" ? "Declining…" : "Decline"}
              </Btn>
            </div>
          </div>
        )}

        {isResolved && !resolvedByAction && (
          <div
            className="blueprint relative"
            style={{
              marginTop: 20,
              padding: "14px 20px",
              backgroundColor: "var(--surface)",
              textAlign: "center",
            }}
          >
            <CornerMarks />
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              This quote has already been <strong>{quote.status}</strong>
              {quote.approvedByName ? ` by ${quote.approvedByName}` : ""}.
            </p>
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 11,
              color: "var(--muted-2)",
            }}
          >
            Powered by GroundworkOS · UK groundwork management
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "4px 0",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        {label}
      </span>
      <span
        className="tnum"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: bold ? 15 : 13,
          color: "var(--ink)",
          fontWeight: bold ? 700 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    draft: { label: "Draft", bg: "var(--surface-3)", color: "var(--ink-2)" },
    sent: { label: "Sent", bg: "var(--accent-bg)", color: "var(--accent)" },
    approved: { label: "Approved", bg: "var(--success-bg)", color: "var(--success)" },
    declined: { label: "Declined", bg: "var(--danger-bg)", color: "var(--danger)" },
    expired: { label: "Expired", bg: "var(--warning-bg)", color: "var(--warning-ink)" },
  };
  const s = map[status] ?? { label: status, bg: "var(--surface-3)", color: "var(--ink-2)" };
  return (
    <span
      style={{
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "var(--font-heading)",
        backgroundColor: s.bg,
        color: s.color,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {s.label}
    </span>
  );
}
