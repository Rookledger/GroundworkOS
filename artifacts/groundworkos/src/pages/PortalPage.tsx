import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle, XCircle, FileText, Building2 } from "lucide-react";

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

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "#f0ede8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: "#7a7469",
            fontSize: 14,
          }}
        >
          Loading quote…
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "#f0ede8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <XCircle
            style={{
              width: 40,
              height: 40,
              color: "#c13a2a",
              margin: "0 auto 12px",
            }}
          />
          <p
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 16,
              color: "#181410",
            }}
          >
            Quote not found
          </p>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              color: "#7a7469",
              marginTop: 4,
            }}
          >
            {error ?? "This link may have expired."}
          </p>
        </div>
      </div>
    );
  }

  const isResolved = quote.status === "approved" || quote.status === "declined";
  const resolvedByAction = outcome;

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "#f0ede8" }}>
      <header
        style={{
          backgroundColor: "#fafaf8",
          borderBottom: "1px solid #d9d4ce",
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "0 24px",
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              color: "#181410",
              letterSpacing: "0.04em",
            }}
          >
            GROUNDWORK<span style={{ color: "#1b5e78" }}>OS</span>
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#a8a099",
              marginLeft: "auto",
            }}
          >
            Client Quote Portal
          </span>
        </div>
      </header>

      <div
        style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 64px" }}
      >
        {resolvedByAction && (
          <div
            style={{
              marginBottom: 24,
              padding: "16px 20px",
              borderRadius: 10,
              border: `1px solid ${resolvedByAction === "approved" ? "rgba(42,110,69,0.25)" : "rgba(193,58,42,0.25)"}`,
              backgroundColor:
                resolvedByAction === "approved"
                  ? "rgba(42,110,69,0.06)"
                  : "rgba(193,58,42,0.06)",
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            {resolvedByAction === "approved" ? (
              <CheckCircle
                style={{
                  width: 20,
                  height: 20,
                  color: "#2a6e45",
                  flexShrink: 0,
                }}
              />
            ) : (
              <XCircle
                style={{
                  width: 20,
                  height: 20,
                  color: "#c13a2a",
                  flexShrink: 0,
                }}
              />
            )}
            <div>
              <p
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  color:
                    resolvedByAction === "approved" ? "#2a6e45" : "#c13a2a",
                }}
              >
                {resolvedByAction === "approved"
                  ? "Quote approved — thank you!"
                  : "Quote declined"}
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  color: "#7a7469",
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
          style={{
            backgroundColor: "#fafaf8",
            border: "1px solid #d9d4ce",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "28px 32px",
              borderBottom: "1px solid #ece8e3",
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
                }}
              >
                <FileText style={{ width: 16, height: 16, color: "#1b5e78" }} />
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: "#1b5e78",
                    fontWeight: 700,
                  }}
                >
                  {quote.quoteNumber}
                </span>
                <StatusBadge status={quote.status} />
              </div>
              <h1
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  color: "#181410",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {quote.title || "Quote"}
              </h1>
              {quote.validUntil && (
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                    color: "#7a7469",
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
                  style={{ width: 12, height: 12, color: "#7a7469" }}
                />
                <span
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#181410",
                  }}
                >
                  {quote.company.name}
                </span>
              </div>
              {quote.company.address && (
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                    color: "#7a7469",
                    lineHeight: 1.5,
                  }}
                >
                  {quote.company.address}
                </p>
              )}
              {quote.company.vatNumber && (
                <p
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: "#a8a099",
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
                borderBottom: "1px solid #ece8e3",
                backgroundColor: "#f7f4f0",
              }}
            >
              <p
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#7a7469",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                Prepared for
              </p>
              <p
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  color: "#181410",
                }}
              >
                {quote.client.companyName}
              </p>
              {quote.client.address && (
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                    color: "#7a7469",
                  }}
                >
                  {quote.client.address}
                </p>
              )}
            </div>
          )}

          <div style={{ padding: "0 32px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ece8e3" }}>
                  {["Description", "Qty", "Unit", "Unit Price", "Total"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 8px 10px",
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#7a7469",
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
                          ? "1px solid #f0ede8"
                          : "none",
                    }}
                  >
                    <td
                      style={{
                        padding: "11px 8px",
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13,
                        color: "#181410",
                        textAlign: "left",
                      }}
                    >
                      {li.description}
                    </td>
                    <td
                      style={{
                        padding: "11px 8px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color: "#4a4540",
                        textAlign: "right",
                      }}
                    >
                      {li.quantity}
                    </td>
                    <td
                      style={{
                        padding: "11px 8px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color: "#7a7469",
                        textAlign: "right",
                      }}
                    >
                      {li.unit}
                    </td>
                    <td
                      style={{
                        padding: "11px 8px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color: "#4a4540",
                        textAlign: "right",
                      }}
                    >
                      {fmt(li.unitPrice)}
                    </td>
                    <td
                      style={{
                        padding: "11px 8px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 13,
                        color: "#181410",
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
              borderTop: "1px solid #ece8e3",
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
                  backgroundColor: "#d9d4ce",
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
                borderTop: "1px solid #ece8e3",
              }}
            >
              <p
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#7a7469",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                Notes
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  color: "#4a4540",
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
            style={{
              marginTop: 24,
              backgroundColor: "#fafaf8",
              border: "1px solid #d9d4ce",
              borderRadius: 12,
              padding: "24px 32px",
            }}
          >
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 15,
                color: "#181410",
                marginBottom: 4,
              }}
            >
              Respond to this quote
            </h2>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                color: "#7a7469",
                marginBottom: 16,
              }}
            >
              Enter your full name to approve or decline this quote.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#4a4540",
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
                  borderRadius: 6,
                  border: "1px solid #d9d4ce",
                  backgroundColor: "#ffffff",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  color: "#181410",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                disabled={!approverName.trim() || !!submitting}
                onClick={() => handleAction("approve")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 7,
                  backgroundColor: "#2a6e45",
                  color: "#ffffff",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  border: "none",
                  cursor:
                    !approverName.trim() || !!submitting
                      ? "not-allowed"
                      : "pointer",
                  opacity: !approverName.trim() || !!submitting ? 0.6 : 1,
                }}
              >
                <CheckCircle style={{ width: 14, height: 14 }} />
                {submitting === "approve" ? "Approving…" : "Approve quote"}
              </button>
              <button
                disabled={!!submitting}
                onClick={() => handleAction("decline")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 7,
                  backgroundColor: "transparent",
                  color: "#c13a2a",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  border: "1px solid rgba(193,58,42,0.3)",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                <XCircle style={{ width: 14, height: 14 }} />
                {submitting === "decline" ? "Declining…" : "Decline"}
              </button>
            </div>
          </div>
        )}

        {isResolved && !resolvedByAction && (
          <div
            style={{
              marginTop: 20,
              padding: "14px 20px",
              borderRadius: 8,
              backgroundColor: "#fafaf8",
              border: "1px solid #d9d4ce",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                color: "#7a7469",
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
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#a8a099",
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
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          color: "#7a7469",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: bold ? 15 : 13,
          color: "#181410",
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
    draft: { label: "Draft", bg: "#f3f4f6", color: "#4a4540" },
    sent: { label: "Sent", bg: "#e8f3f7", color: "#1b5e78" },
    approved: { label: "Approved", bg: "#dcfce7", color: "#2a6e45" },
    declined: { label: "Declined", bg: "#fee2e2", color: "#c13a2a" },
    expired: { label: "Expired", bg: "#fef3c7", color: "#92400e" },
  };
  const s = map[status] ?? { label: status, bg: "#f3f4f6", color: "#4a4540" };
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "'Space Grotesk', sans-serif",
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
