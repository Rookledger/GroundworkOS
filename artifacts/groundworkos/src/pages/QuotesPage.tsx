import { useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  X,
  ChevronRight,
  Download,
  Share2,
  Copy,
  Mail,
  FileText,
} from "lucide-react";
import { useLocation } from "wouter";
import { pdf } from "@react-pdf/renderer";
import { QuotePDF } from "../lib/pdf/QuotePDF";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";
import { Btn } from "../components/ui/Btn";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal, Field, Input, Select, Textarea } from "../components/ui/Modal";
import { cn, formatCurrency, formatDate } from "../lib/utils";
import { useApp } from "../store/AppContext";
import {
  createQuote,
  updateQuote,
  deleteQuote,
} from "@workspace/api-client-react";
import { toQuote } from "../lib/apiTransforms";
import { toast } from "sonner";
import type { LineItem } from "../types";

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "accepted", label: "Accepted" },
  { id: "declined", label: "Declined" },
];

const emptyLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unit: "m²",
  unit_price: 0,
  total: 0,
});

const makeEmptyForm = () => ({
  client_id: "",
  title: "",
  valid_until: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })(),
  notes: "",
  line_items: [emptyLineItem()],
});

export function QuotesPage() {
  const { state, dispatch } = useApp();
  const { quotes, clients, settings } = state;
  const [, navigate] = useLocation();

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filtered = quotes.filter((q) => {
    if (tab !== "all" && q.status !== tab) return false;
    if (search) {
      const sq = search.toLowerCase();
      return (
        (q.title ?? "").toLowerCase().includes(sq) ||
        q.quote_number.toLowerCase().includes(sq) ||
        (q.client?.company_name ?? "").toLowerCase().includes(sq)
      );
    }
    return true;
  });

  const accepted = quotes.filter((q) => q.status === "accepted");
  const sentAndAbove = quotes.filter((q) => q.status !== "draft");
  const acceptedRate =
    sentAndAbove.length > 0
      ? Math.round((accepted.length / sentAndAbove.length) * 100)
      : 0;

  function updateLineItem(
    id: string,
    field: keyof LineItem,
    value: string | number,
  ) {
    setForm((f) => ({
      ...f,
      line_items: f.line_items.map((li) => {
        if (li.id !== id) return li;
        const updated = { ...li, [field]: value };
        updated.total =
          Math.round(updated.quantity * updated.unit_price * 100) / 100;
        return updated;
      }),
    }));
  }

  function addLineItem() {
    setForm((f) => ({ ...f, line_items: [...f.line_items, emptyLineItem()] }));
  }

  function removeLineItem(id: string) {
    setForm((f) => ({
      ...f,
      line_items: f.line_items.filter((li) => li.id !== id),
    }));
  }

  const subtotal = form.line_items.reduce((s, li) => s + li.total, 0);
  const vatAmount = Math.round(subtotal * 0.2 * 100) / 100;
  const total = subtotal + vatAmount;

  function openNew() {
    setForm(makeEmptyForm());
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.client_id) e.client_id = "Client is required";
    if (!form.title.trim()) e.title = "Title is required";
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSaving(true);
    try {
      const validLineItems = form.line_items.filter((li) =>
        li.description.trim(),
      );
      const result = await createQuote({
        clientId: form.client_id,
        title: form.title.trim(),
        validUntil: form.valid_until || undefined,
        notes: form.notes || undefined,
        lineItems: validLineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          unitPrice: li.unit_price,
        })),
        // The generated `QuoteInput`/`LineItemRecord` types (orval, from the
        // OpenAPI spec) require server-generated fields like `id` and
        // `quoteNumber` that a create request must never send — the real
        // runtime contract is `CreateQuoteInput`/`QuoteLineItemInput` in
        // lib/api-zod/src/requestSchemas.ts, which this payload matches
        // exactly. The cast bridges that known generated-type/runtime gap.
      } as any);
      dispatch({ type: "ADD_QUOTE", quote: toQuote(result) });
      setShowModal(false);
      toast.success(`Quote ${result.quoteNumber} created`);
    } catch {
      toast.error("Failed to create quote");
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote(id: string) {
    const prev = quotes.find((q) => q.id === id);
    const sentAt = new Date().toISOString();
    dispatch({
      type: "UPDATE_QUOTE",
      id,
      updates: { status: "sent", sent_at: sentAt },
    });
    try {
      await updateQuote(id, { status: "sent", sentAt });
      toast.success("Quote marked as sent");
    } catch {
      if (prev)
        dispatch({
          type: "UPDATE_QUOTE",
          id,
          updates: { status: prev.status, sent_at: prev.sent_at },
        });
      toast.error("Failed to update quote");
    }
  }

  async function acceptQuote(id: string) {
    const prev = quotes.find((q) => q.id === id);
    dispatch({ type: "UPDATE_QUOTE", id, updates: { status: "accepted" } });
    try {
      await updateQuote(id, { status: "accepted" });
      toast.success("Quote accepted");
    } catch {
      if (prev)
        dispatch({
          type: "UPDATE_QUOTE",
          id,
          updates: { status: prev.status },
        });
      toast.error("Failed to update quote");
    }
  }

  const [pdfing, setPdfing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  async function sendByEmail() {
    if (!selectedQuote || !emailTo.trim()) return;
    setEmailSending(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${BASE}/api/email/send-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: selectedQuote.id,
          to: emailTo.trim(),
          subject: emailSubject.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      dispatch({
        type: "UPDATE_QUOTE",
        id: selectedQuote.id,
        updates: { status: "sent" },
      });
      toast.success(`Quote emailed to ${emailTo.trim()}`);
      setShowEmailModal(false);
      setEmailTo("");
      setEmailSubject("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  }

  async function shareQuote(id: string) {
    setSharing(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${BASE}/api/quotes/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error();
      const { url } = await r.json();
      await navigator.clipboard.writeText(url);
      toast.success("Portal link copied to clipboard");
    } catch {
      toast.error("Failed to generate share link");
    } finally {
      setSharing(false);
    }
  }

  async function downloadQuotePdf(q: (typeof quotes)[0]) {
    setPdfing(true);
    try {
      const blob = await pdf(
        <QuotePDF quote={q} company={settings as any} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${q.quote_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setPdfing(false);
    }
  }

  async function handleDelete(id: string, quoteNumber: string) {
    if (!confirm(`Delete quote ${quoteNumber}? This cannot be undone.`)) return;
    try {
      await deleteQuote(id);
      dispatch({ type: "REMOVE_QUOTE", id });
      setSelected(null);
      toast.success(`Quote ${quoteNumber} deleted`);
    } catch {
      toast.error("Failed to delete quote");
    }
  }

  const selectedQuote = selected ? quotes.find((q) => q.id === selected) : null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Quotes
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Create and manage quotations
          </p>
        </div>
        <Btn onClick={openNew}>
          <Plus className="w-4 h-4" strokeWidth={1.5} /> New Quote
        </Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Quoted"
          value={formatCurrency(quotes.reduce((s, q) => s + q.total_amount, 0))}
          sub={`${quotes.length} quotes`}
        />
        <StatCard
          label="Accepted Rate"
          value={`${acceptedRate}%`}
          sub={`${accepted.length} accepted`}
          accent
        />
        <StatCard
          label="Accepted Value"
          value={formatCurrency(
            accepted.reduce((s, q) => s + q.total_amount, 0),
          )}
          sub="converted"
          accent
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div
          className="flex items-center gap-1"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {TABS.map((t) => {
            const count =
              t.id === "all"
                ? quotes.length
                : quotes.filter((q) => q.status === t.id).length;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-2.5 text-sm transition-colors relative flex items-center gap-1.5"
                style={
                  isActive
                    ? { color: "var(--ink)", fontWeight: 600 }
                    : { color: "var(--muted)", fontWeight: 500 }
                }
              >
                {t.label}
                <span
                  className="inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-bold tnum"
                  style={{
                    fontFamily: "var(--font-heading)",
                    backgroundColor: isActive ? "var(--accent-bg)" : "var(--surface-3)",
                    color: isActive ? "var(--accent)" : "var(--muted-2)",
                  }}
                >
                  {count}
                </span>
                {isActive && (
                  <div
                    className="absolute bottom-[-1px] left-0 w-full h-[2px]"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--muted-2)" }}
          strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search quotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm w-64 focus:outline-none transition-colors"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--ink)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedQuote ? "lg:col-span-2" : "lg:col-span-3"}>
          <Panel noPad>
            {filtered.length === 0 ? (
              quotes.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No quotes yet"
                  description="Quotes let you price up work and send it to a client for sign-off before it becomes a job."
                  primaryLabel="Create your first quote"
                  onPrimary={openNew}
                  secondaryLabel="Import from spreadsheet"
                  onSecondary={() => navigate("/import")}
                  hint="You can also import existing quotes as a CSV."
                />
              ) : (
                <EmptyState
                  icon={Search}
                  title="No quotes match your filters"
                  description="Try a different search term or switch tabs."
                  primaryLabel="Clear filters"
                  onPrimary={() => {
                    setTab("all");
                    setSearch("");
                  }}
                />
              )
            ) : (
              filtered.map((q, i) => {
                const isExpired = q.status === "expired";
                return (
                  <div
                    key={q.id}
                    onClick={() => setSelected(selected === q.id ? null : q.id)}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--surface-2)] group"
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      backgroundColor: isExpired
                        ? "var(--danger-bg)"
                        : selected === q.id
                          ? "var(--surface-2)"
                          : undefined,
                      borderLeft: isExpired
                        ? "3px solid var(--danger)"
                        : selected === q.id
                          ? "3px solid var(--accent)"
                          : "3px solid transparent",
                    }}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "var(--surface-3)" }}
                      >
                        <FileText
                          className="w-4 h-4"
                          style={{ color: "var(--muted)" }}
                          strokeWidth={1.5}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                          <span
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--ink)" }}
                          >
                            {q.title ?? "—"}
                          </span>
                          <span className="sm:hidden">
                            <Badge status={q.status} />
                          </span>
                        </div>
                        <div
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          <span className="font-mono tnum">{q.quote_number}</span>
                          <span>{q.client?.company_name ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 pl-12 sm:pl-0 flex-shrink-0">
                      <span className="hidden sm:block">
                        <Badge status={q.status} />
                      </span>
                      <div className="text-right flex-shrink-0 w-28">
                        <div
                          className="text-sm font-semibold tnum"
                          style={{ color: "var(--ink)" }}
                        >
                          {formatCurrency(q.total_amount)}
                        </div>
                        {q.valid_until && (
                          <div
                            className="text-[11px] tnum mt-0.5"
                            style={{
                              color: isExpired ? "var(--danger-ink)" : "var(--muted)",
                            }}
                          >
                            Until {formatDate(q.valid_until)}
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"
                        style={{ color: "var(--muted)" }}
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </Panel>
        </div>

        {selectedQuote && (
          <div>
            <Panel
              actions={
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      handleDelete(selectedQuote.id, selectedQuote.quote_number)
                    }
                    className="p-1 hover:bg-red-50 transition-colors"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 hover:bg-[var(--surface-3)] transition-colors"
                    style={{ color: "var(--muted)" }}
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              }
            >
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-mono tnum"
                      style={{ color: "var(--muted)" }}
                    >
                      {selectedQuote.quote_number}
                    </span>
                    <Badge status={selectedQuote.status} />
                  </div>
                  <h3
                    className="text-lg font-semibold leading-snug"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {selectedQuote.title}
                  </h3>
                </div>

                <div
                  className="space-y-3 pt-4"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  {[
                    {
                      label: "Client",
                      value: selectedQuote.client?.company_name ?? "—",
                    },
                    { label: "Sent", value: formatDate(selectedQuote.sent_at) },
                    {
                      label: "Valid Until",
                      value: formatDate(selectedQuote.valid_until),
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between items-baseline gap-3 pt-3"
                      style={{ borderTop: "1px solid var(--surface-3)" }}
                    >
                      <span
                        className="text-[11px] font-bold uppercase tracking-widest flex-shrink-0"
                        style={{ color: "var(--muted)" }}
                      >
                        {label}
                      </span>
                      <span
                        className={cn(
                          "text-sm text-right",
                          label !== "Client" && "font-mono tnum",
                        )}
                        style={{ color: "var(--ink)" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {selectedQuote.line_items.length > 0 && (
                  <div>
                    <p
                      className="text-[11px] font-bold uppercase tracking-widest mb-3"
                      style={{
                        color: "var(--muted)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      Line Items
                    </p>
                    <div className="space-y-2">
                      {selectedQuote.line_items.map((li) => (
                        <div
                          key={li.id}
                          className="flex items-start justify-between gap-3 text-xs pb-3"
                          style={{ borderBottom: "1px solid var(--surface-3)" }}
                        >
                          <div className="flex-1">
                            <div
                              className="mb-1 font-medium"
                              style={{ color: "var(--ink)" }}
                            >
                              {li.description}
                            </div>
                            <div
                              className="font-mono tnum"
                              style={{ color: "var(--muted)" }}
                            >
                              {li.quantity} {li.unit} ×{" "}
                              {formatCurrency(li.unit_price)}
                            </div>
                          </div>
                          <div
                            className="font-semibold flex-shrink-0 font-mono tnum mt-0.5"
                            style={{ color: "var(--ink)" }}
                          >
                            {formatCurrency(li.total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="pt-4 space-y-2"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  {[
                    {
                      label: "Subtotal",
                      value: formatCurrency(selectedQuote.subtotal),
                    },
                    {
                      label: "VAT (20%)",
                      value: formatCurrency(selectedQuote.vat_amount),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span
                        className="text-[11px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--muted)" }}
                      >
                        {label}
                      </span>
                      <span
                        className="font-mono tnum"
                        style={{ color: "var(--muted-2)" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                  <div
                    className="flex justify-between items-center pt-3 mt-1"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <span
                      className="text-[11px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--ink)" }}
                    >
                      Total
                    </span>
                    <span
                      className="font-mono tnum font-bold text-xl"
                      style={{ color: "var(--ink)" }}
                    >
                      {formatCurrency(selectedQuote.total_amount)}
                    </span>
                  </div>
                </div>

                {selectedQuote.notes && (
                  <div>
                    <p
                      className="text-[11px] font-bold uppercase tracking-widest mb-2"
                      style={{
                        color: "var(--muted)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      Notes
                    </p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {selectedQuote.notes}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-4">
                  {selectedQuote.status === "draft" && (
                    <Btn
                      size="md"
                      className="w-full justify-center"
                      onClick={() => sendQuote(selectedQuote.id)}
                    >
                      Send Quote
                    </Btn>
                  )}
                  {selectedQuote.status === "sent" && (
                    <Btn
                      size="md"
                      className="w-full justify-center"
                      onClick={() => acceptQuote(selectedQuote.id)}
                    >
                      Mark Accepted
                    </Btn>
                  )}
                  <Btn
                    variant="outline"
                    size="md"
                    className="w-full justify-center"
                    disabled={pdfing}
                    onClick={() => downloadQuotePdf(selectedQuote)}
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={1.5} />{" "}
                    {pdfing ? "Generating…" : "Download PDF"}
                  </Btn>
                  <Btn
                    variant="outline"
                    size="md"
                    className="w-full justify-center"
                    onClick={() => {
                      setEmailTo("");
                      setEmailSubject("");
                      setShowEmailModal(true);
                    }}
                  >
                    <Mail className="w-3.5 h-3.5" strokeWidth={1.5} /> Send by Email
                  </Btn>
                  <Btn
                    variant="outline"
                    size="md"
                    className="w-full justify-center"
                    disabled={sharing}
                    onClick={() => shareQuote(selectedQuote.id)}
                  >
                    {sharing ? (
                      <Share2 className="w-3.5 h-3.5 animate-pulse" strokeWidth={1.5} />
                    ) : (
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                    )}
                    {sharing ? "Generating link…" : "Copy client portal link"}
                  </Btn>
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="New Quote"
        wide
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client" required>
              <Select
                value={form.client_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, client_id: e.target.value }))
                }
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </Select>
              {errors.client_id && (
                <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                  {errors.client_id}
                </p>
              )}
            </Field>
            <Field label="Valid Until">
              <Input
                type="date"
                value={form.valid_until}
                onChange={(e) =>
                  setForm((f) => ({ ...f, valid_until: e.target.value }))
                }
                className="font-mono tnum"
              />
            </Field>
          </div>
          <Field label="Quote Title" required>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Drainage Installation — New Estate Phase 2"
            />
            {errors.title && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {errors.title}
              </p>
            )}
          </Field>
          <div>
            <div className="flex items-center justify-between mb-3 mt-4">
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                Line Items
              </span>
              <button
                onClick={addLineItem}
                className="text-xs flex items-center gap-1 font-medium transition-colors hover:text-[var(--accent)]"
                style={{ color: "var(--ink-2)" }}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {form.line_items.map((li, idx) => (
                <div
                  key={li.id}
                  className="p-4 space-y-3"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--muted)" }}
                    >
                      Item {idx + 1}
                    </span>
                    {form.line_items.length > 1 && (
                      <button
                        onClick={() => removeLineItem(li.id)}
                        className="transition-colors hover:text-[var(--danger)]"
                        style={{ color: "var(--muted)" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  <Input
                    value={li.description}
                    onChange={(e) =>
                      updateLineItem(li.id, "description", e.target.value)
                    }
                    placeholder="Description"
                  />
                  <div className="grid grid-cols-4 gap-3">
                    <Input
                      type="number"
                      value={li.quantity}
                      onChange={(e) =>
                        updateLineItem(
                          li.id,
                          "quantity",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="Qty"
                      className="font-mono tnum"
                    />
                    <Input
                      value={li.unit}
                      onChange={(e) =>
                        updateLineItem(li.id, "unit", e.target.value)
                      }
                      placeholder="Unit"
                      className="font-mono tnum"
                    />
                    <Input
                      type="number"
                      value={li.unit_price || ""}
                      onChange={(e) =>
                        updateLineItem(
                          li.id,
                          "unit_price",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="£/unit"
                      className="font-mono tnum"
                    />
                    <div
                      className="py-2 px-3 text-sm text-right font-mono tnum font-medium"
                      style={{
                        backgroundColor: "var(--surface)",
                        color: "var(--ink)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {formatCurrency(li.total)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {subtotal > 0 && (
            <div
              className="p-4 space-y-2 mt-4"
              style={{
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              {[
                { label: "Subtotal", value: formatCurrency(subtotal) },
                { label: "VAT (20%)", value: formatCurrency(vatAmount) },
                { label: "Total", value: formatCurrency(total) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--muted)" }}
                  >
                    {label}
                  </span>
                  <span
                    className={cn(
                      "font-mono tnum",
                      label === "Total" && "font-bold text-base",
                    )}
                    style={{ color: label === "Total" ? "var(--ink)" : "var(--ink-2)" }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="e.g. Disposal costs subject to tip charges in force at time of works."
                rows={2}
              />
            </Field>
          </div>
          <div className="flex gap-3 pt-4">
            <Btn
              className="flex-1 justify-center"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Creating…" : "Create Quote"}
            </Btn>
            <Btn variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      </Modal>

      {showEmailModal && selectedQuote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(24,20,16,0.5)" }}
        >
          <div
            className="w-full max-w-md shadow-2xl overflow-hidden"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid var(--surface-3)" }}
            >
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{
                    color: "var(--ink)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  Send Quote by Email
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {selectedQuote.quote_number}
                </p>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-1.5 hover:bg-[var(--surface-2)]"
              >
                <X className="w-4 h-4" style={{ color: "var(--muted)" }} strokeWidth={1.5} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label
                  className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: "var(--muted)" }}
                >
                  Recipient Email *
                </label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 text-sm focus:outline-none"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1.5px solid var(--border)",
                    color: "var(--ink)",
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label
                  className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: "var(--muted)" }}
                >
                  Subject (optional)
                </label>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={`Quote ${selectedQuote.quote_number}`}
                  className="w-full px-3 py-2 text-sm focus:outline-none"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1.5px solid var(--border)",
                    color: "var(--ink)",
                  }}
                />
              </div>
              <div
                className="flex items-start gap-2 p-3 text-xs"
                style={{ backgroundColor: "var(--accent-bg)", color: "var(--accent)" }}
              >
                <Mail className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>
                  The full quote breakdown will be included in the email body.
                  The quote will be marked as Sent.
                </span>
              </div>
            </div>
            <div
              className="flex gap-3 px-6 py-4"
              style={{ borderTop: "1px solid var(--surface-3)" }}
            >
              <Btn
                variant="outline"
                className="flex-1"
                onClick={() => setShowEmailModal(false)}
              >
                Cancel
              </Btn>
              <Btn
                className="flex-1"
                onClick={sendByEmail}
                disabled={emailSending || !emailTo.trim()}
              >
                <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />{" "}
                {emailSending ? "Sending…" : "Send Quote"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
