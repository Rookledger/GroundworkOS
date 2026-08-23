import { useState } from "react";
import { Plus, Download, X, ChevronRight, Trash2, Mail } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { InvoicePDF } from "../lib/pdf/InvoicePDF";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";
import { Btn } from "../components/ui/Btn";
import { Modal, Field, Input, Select, Textarea } from "../components/ui/Modal";
import { cn, formatCurrency, formatDate, daysOverdue } from "../lib/utils";
import { useApp } from "../store/AppContext";
import {
  createInvoice,
  updateInvoice,
  deleteInvoice,
} from "@workspace/api-client-react";
import { toInvoice } from "../lib/apiTransforms";
import { toast } from "sonner";

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
];

const emptyForm = {
  client_id: "",
  job_id: "",
  subtotal: "",
  notes: "",
  issued_date: new Date().toISOString().split("T")[0],
  due_date: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })(),
};

export function InvoicesPage() {
  const { state, dispatch } = useApp();
  const { invoices, clients, jobs, settings } = state;

  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filtered = invoices.filter((i) => tab === "all" || i.status === tab);
  const totalOutstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "credited")
    .reduce((s, i) => s + i.total_amount, 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.total_amount, 0);
  const overdueTotal = invoices
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.total_amount, 0);
  const selectedInv = selected ? invoices.find((i) => i.id === selected) : null;

  const subtotal = parseFloat(form.subtotal) || 0;
  const vatAmount = Math.round(subtotal * 0.2 * 100) / 100;
  const total = subtotal + vatAmount;

  function openNew() {
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.client_id) e.client_id = "Client is required";
    if (!form.subtotal || parseFloat(form.subtotal) <= 0)
      e.subtotal = "Amount must be greater than 0";
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
      const result = await createInvoice({
        clientId: form.client_id,
        jobId: form.job_id || undefined,
        subtotal,
        vatAmount,
        totalAmount: total,
        status: "draft",
        issuedDate: form.issued_date,
        dueDate: form.due_date,
        notes: form.notes || undefined,
      } as any);
      dispatch({ type: "ADD_INVOICE", invoice: toInvoice(result) });
      setShowModal(false);
      toast.success(`Invoice ${result.invoiceNumber} created`);
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(id: string) {
    const prev = invoices.find((i) => i.id === id);
    const paidAt = new Date().toISOString();
    dispatch({
      type: "UPDATE_INVOICE",
      id,
      updates: { status: "paid", paid_at: paidAt },
    });
    try {
      await updateInvoice(id, { status: "paid", paidAt });
      toast.success("Invoice marked as paid");
    } catch {
      if (prev)
        dispatch({
          type: "UPDATE_INVOICE",
          id,
          updates: { status: prev.status, paid_at: prev.paid_at },
        });
      toast.error("Failed to update invoice");
    }
  }

  async function markSent(id: string) {
    const prev = invoices.find((i) => i.id === id);
    dispatch({ type: "UPDATE_INVOICE", id, updates: { status: "sent" } });
    try {
      await updateInvoice(id, { status: "sent" });
      toast.success("Invoice marked as sent");
    } catch {
      if (prev)
        dispatch({
          type: "UPDATE_INVOICE",
          id,
          updates: { status: prev.status },
        });
      toast.error("Failed to update invoice");
    }
  }

  const [pdfing, setPdfing] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  async function sendByEmail() {
    if (!selectedInv || !emailTo.trim()) return;
    setEmailSending(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${BASE}/api/email/send-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: selectedInv.id,
          to: emailTo.trim(),
          subject: emailSubject.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      dispatch({
        type: "UPDATE_INVOICE",
        id: selectedInv.id,
        updates: { status: "sent" },
      });
      toast.success(`Invoice emailed to ${emailTo.trim()}`);
      setShowEmailModal(false);
      setEmailTo("");
      setEmailSubject("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  }

  async function downloadInvoicePdf(inv: (typeof invoices)[0]) {
    setPdfing(true);
    try {
      const blob = await pdf(
        <InvoicePDF invoice={inv} company={settings as any} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoice_number}.pdf`;
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

  async function handleDelete(id: string, invoiceNumber: string) {
    if (!confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`))
      return;
    try {
      await deleteInvoice(id);
      dispatch({ type: "REMOVE_INVOICE", id });
      setSelected(null);
      toast.success(`Invoice ${invoiceNumber} deleted`);
    } catch {
      toast.error("Failed to delete invoice");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#181410" }}>
            Invoices
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#7a7469" }}>
            Track payments and outstanding amounts
          </p>
        </div>
        <Btn onClick={openNew}>
          <Plus className="w-4 h-4" /> New Invoice
        </Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          accent
          label="Outstanding"
          value={formatCurrency(totalOutstanding)}
          sub={`${invoices.filter((i) => i.status === "sent" || i.status === "overdue").length} invoices`}
        />
        <StatCard
          danger={overdueTotal > 0}
          label="Overdue"
          value={formatCurrency(overdueTotal)}
          sub={`${invoices.filter((i) => i.status === "overdue").length} overdue`}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(totalPaid)}
          sub={`${invoices.filter((i) => i.status === "paid").length} paid`}
        />
      </div>

      <div
        className="flex items-center gap-1"
        style={{ borderBottom: "1px solid #d9d4ce" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm transition-colors"
            style={
              tab === t.id
                ? {
                    color: "#181410",
                    fontWeight: 500,
                    borderBottom: "2px solid #1b5e78",
                    marginBottom: "-1px",
                  }
                : { color: "#7a7469" }
            }
          >
            {t.label}
            {t.id !== "all" && (
              <span
                className="text-xs ml-1.5"
                style={{ color: tab === t.id ? "#8a8377" : "#c0bab4" }}
              >
                {invoices.filter((i) => i.status === t.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={selectedInv ? "xl:col-span-2" : "xl:col-span-3"}>
          <Panel noPad>
            {filtered.length === 0 ? (
              <p
                className="text-center py-12 text-sm"
                style={{ color: "#c0bab4" }}
              >
                No invoices
              </p>
            ) : (
              filtered.map((inv, i) => {
                const overdueDays =
                  inv.status === "overdue" ? daysOverdue(inv.due_date) : 0;
                return (
                  <div
                    key={inv.id}
                    onClick={() =>
                      setSelected(selected === inv.id ? null : inv.id)
                    }
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[#eeeae4] group"
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? "1px solid #d9d4ce" : "none",
                      backgroundColor:
                        selected === inv.id ? "#eeeae4" : undefined,
                      borderLeft:
                        selected === inv.id
                          ? "2px solid #1b5e78"
                          : "2px solid transparent",
                    }}
                  >
                    <span
                      className="text-xs w-28 flex-shrink-0 font-mono font-medium"
                      style={{ color: "#7a7469" }}
                    >
                      {inv.invoice_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-semibold truncate"
                        style={{ color: "#181410" }}
                      >
                        {inv.client?.company_name ?? "—"}
                      </div>
                      <div
                        className="text-xs mt-0.5 truncate"
                        style={{ color: "#7a7469" }}
                      >
                        {inv.job?.title ?? "—"}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-4">
                      <Badge status={inv.status} />
                      {overdueDays > 0 && (
                        <span
                          className="text-xs flex-shrink-0 font-mono font-bold"
                          style={{ color: "#c13a2a" }}
                        >
                          {overdueDays}d overdue
                        </span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 w-28 ml-2">
                      <div
                        className="text-sm font-bold font-mono tnum"
                        style={{ color: "#181410" }}
                      >
                        {formatCurrency(inv.total_amount)}
                      </div>
                      <div
                        className="text-[11px] font-mono mt-0.5"
                        style={{ color: "#7a7469" }}
                      >
                        Due {formatDate(inv.due_date)}
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 flex-shrink-0 transition-opacity ml-2",
                        selected === inv.id
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100",
                      )}
                      style={{ color: "#7a7469" }}
                    />
                  </div>
                );
              })
            )}
          </Panel>
        </div>

        {selectedInv && (
          <div>
            <Panel
              actions={
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      handleDelete(selectedInv.id, selectedInv.invoice_number)
                    }
                    className="p-1 rounded transition-colors hover:bg-red-50"
                    style={{ color: "#c13a2a" }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="hover:text-[#181410] transition-colors p-1"
                    style={{ color: "#7a7469" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              }
            >
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-mono font-medium"
                      style={{ color: "#7a7469" }}
                    >
                      {selectedInv.invoice_number}
                    </span>
                    <Badge status={selectedInv.status} />
                  </div>
                  <p
                    className="text-base font-bold"
                    style={{ color: "#181410" }}
                  >
                    {selectedInv.client?.company_name}
                  </p>
                </div>

                <div
                  className="space-y-3 pt-1"
                  style={{ borderTop: "1px solid #d9d4ce" }}
                >
                  {[
                    { label: "Job", value: selectedInv.job?.title ?? "—" },
                    {
                      label: "Issued",
                      value: formatDate(selectedInv.issued_date),
                      mono: true,
                    },
                    {
                      label: "Due",
                      value: formatDate(selectedInv.due_date),
                      mono: true,
                    },
                    {
                      label: "Paid",
                      value: selectedInv.paid_at
                        ? formatDate(selectedInv.paid_at)
                        : "—",
                      mono: true,
                    },
                  ].map(({ label, value, mono }) => (
                    <div
                      key={label}
                      className="flex justify-between items-baseline gap-3 pt-3"
                      style={{ borderTop: "1px solid #ece8e3" }}
                    >
                      <span
                        className="text-xs flex-shrink-0 font-medium uppercase tracking-wider"
                        style={{ color: "#7a7469" }}
                      >
                        {label}
                      </span>
                      <span
                        className={cn(
                          "text-sm text-right truncate font-medium",
                          mono && "font-mono text-[13px]",
                        )}
                        style={{ color: "#181410" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  className="pt-3 space-y-2"
                  style={{ borderTop: "1px solid #d9d4ce" }}
                >
                  {[
                    {
                      label: "Subtotal",
                      value: formatCurrency(selectedInv.subtotal),
                    },
                    {
                      label: "VAT (20%)",
                      value: formatCurrency(selectedInv.vat_amount),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span
                        className="font-medium"
                        style={{ color: "#7a7469" }}
                      >
                        {label}
                      </span>
                      <span className="font-mono" style={{ color: "#8a8377" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                  <div
                    className="flex justify-between font-bold pt-2"
                    style={{ borderTop: "1px solid #d9d4ce" }}
                  >
                    <span
                      className="uppercase tracking-widest text-xs"
                      style={{ color: "#181410" }}
                    >
                      Total
                    </span>
                    <span
                      className="font-mono tnum"
                      style={{ color: "#181410", fontSize: "1.2rem" }}
                    >
                      {formatCurrency(selectedInv.total_amount)}
                    </span>
                  </div>
                </div>

                {selectedInv.notes && (
                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                      style={{ color: "#7a7469" }}
                    >
                      Notes
                    </p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#4a4540" }}
                    >
                      {selectedInv.notes}
                    </p>
                  </div>
                )}

                <div
                  className="flex flex-col gap-2 pt-3"
                  style={{ borderTop: "1px solid #d9d4ce" }}
                >
                  {selectedInv.status === "draft" && (
                    <Btn
                      size="sm"
                      className="w-full justify-center"
                      onClick={() => markSent(selectedInv.id)}
                    >
                      Mark as Sent
                    </Btn>
                  )}
                  {(selectedInv.status === "sent" ||
                    selectedInv.status === "overdue") && (
                    <Btn
                      size="sm"
                      className="w-full justify-center"
                      onClick={() => markPaid(selectedInv.id)}
                    >
                      Mark as Paid
                    </Btn>
                  )}
                  <Btn
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    disabled={pdfing}
                    onClick={() => downloadInvoicePdf(selectedInv)}
                  >
                    <Download className="w-3.5 h-3.5" />{" "}
                    {pdfing ? "Generating…" : "Download PDF"}
                  </Btn>
                  <Btn
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => {
                      setEmailTo("");
                      setEmailSubject("");
                      setShowEmailModal(true);
                    }}
                  >
                    <Mail className="w-3.5 h-3.5" /> Send by Email
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
        title="New Invoice"
      >
        <div className="space-y-4">
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
              <p className="mt-1 text-xs" style={{ color: "#c13a2a" }}>
                {errors.client_id}
              </p>
            )}
          </Field>
          <Field label="Related Job">
            <Select
              value={form.job_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, job_id: e.target.value }))
              }
            >
              <option value="">None</option>
              {jobs
                .filter(
                  (j) => !form.client_id || j.client_id === form.client_id,
                )
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_number} — {j.title}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue Date">
              <Input
                type="date"
                value={form.issued_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, issued_date: e.target.value }))
                }
              />
            </Field>
            <Field label="Due Date">
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, due_date: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Subtotal (£ excl. VAT)" required>
            <Input
              type="number"
              value={form.subtotal}
              onChange={(e) =>
                setForm((f) => ({ ...f, subtotal: e.target.value }))
              }
              placeholder="0.00"
            />
            {errors.subtotal && (
              <p className="mt-1 text-xs" style={{ color: "#c13a2a" }}>
                {errors.subtotal}
              </p>
            )}
          </Field>
          {subtotal > 0 && (
            <div
              className="p-4 rounded-lg space-y-2"
              style={{
                backgroundColor: "#eeeae4",
                border: "1px solid #d9d4ce",
              }}
            >
              {[
                { label: "Subtotal", value: formatCurrency(subtotal) },
                { label: "VAT (20%)", value: formatCurrency(vatAmount) },
                { label: "Total", value: formatCurrency(total) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span style={{ color: "#7a7469" }}>{label}</span>
                  <span
                    style={{
                      color: label === "Total" ? "#181410" : "#8a8377",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: label === "Total" ? 600 : 400,
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="e.g. Stage 1 — drainage installation complete"
              rows={2}
            />
          </Field>
          <div className="flex gap-3 pt-2">
            <Btn
              className="flex-1 justify-center"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Creating…" : "Create Invoice"}
            </Btn>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      </Modal>

      {showEmailModal && selectedInv && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(24,20,16,0.5)" }}
        >
          <div
            className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid #e8e4dd" }}
            >
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{
                    color: "#181410",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Send Invoice by Email
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#7a7469" }}>
                  {selectedInv.invoice_number}
                </p>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-1.5 rounded hover:bg-[#eeeae4]"
              >
                <X className="w-4 h-4" style={{ color: "#7a7469" }} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label
                  className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: "#7a7469" }}
                >
                  Recipient Email *
                </label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1.5px solid #d9d4ce",
                    color: "#181410",
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label
                  className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: "#7a7469" }}
                >
                  Subject (optional)
                </label>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={`Invoice ${selectedInv.invoice_number}`}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1.5px solid #d9d4ce",
                    color: "#181410",
                  }}
                />
              </div>
              <div
                className="flex items-start gap-2 p-3 rounded-lg text-xs"
                style={{ backgroundColor: "#e8f3f7", color: "#1b5e78" }}
              >
                <Mail className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  The invoice breakdown and payment details will be included in
                  the email body. The invoice will be marked as Sent.
                </span>
              </div>
            </div>
            <div
              className="flex gap-3 px-6 py-4"
              style={{ borderTop: "1px solid #e8e4dd" }}
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
                <Mail className="w-3.5 h-3.5" />{" "}
                {emailSending ? "Sending…" : "Send Invoice"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
