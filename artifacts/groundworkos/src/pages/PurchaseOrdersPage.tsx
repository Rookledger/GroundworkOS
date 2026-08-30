import { useState, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Download,
  X,
  ChevronRight,
  Package,
  Truck,
  FileCheck,
  AlertCircle,
  Search,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { useLocation } from "wouter";
import { useApp } from "../store/AppContext";
import { Btn } from "../components/ui/Btn";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { EmptyState } from "../components/ui/EmptyState";
import { formatCurrency, formatDate } from "../lib/utils";
import { toPurchaseOrder } from "../lib/apiTransforms";
import { PurchaseOrderPDF } from "../lib/pdf/PurchaseOrderPDF";
import { toast } from "sonner";
import type { PurchaseOrder, PurchaseOrderStatus } from "../types";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

const STATUS_CONFIG: Record<
  PurchaseOrderStatus,
  { label: string; color: string; bg: string; icon: React.FC<any> }
> = {
  draft: { label: "Draft", color: "var(--muted)", bg: "var(--surface-2)", icon: AlertCircle },
  ordered: {
    label: "Ordered",
    color: "var(--warning)",
    bg: "var(--warning-bg)",
    icon: ShoppingCart,
  },
  received: {
    label: "Received",
    color: "var(--success)",
    bg: "var(--success-bg)",
    icon: Package,
  },
  invoiced: {
    label: "Invoiced",
    color: "var(--accent)",
    bg: "var(--accent-bg)",
    icon: FileCheck,
  },
};

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {status === "ordered" && <Truck className="w-3 h-3" strokeWidth={1.5} />}
      {cfg.label}
    </span>
  );
}

const EMPTY_FORM = {
  supplier: "",
  description: "",
  jobId: "",
  amount: "",
  vatAmount: "",
  status: "draft" as PurchaseOrderStatus,
  orderDate: new Date().toISOString().slice(0, 10),
  expectedDelivery: "",
  deliveryDate: "",
  notes: "",
};

type FormState = typeof EMPTY_FORM;

export function PurchaseOrdersPage() {
  const { state, dispatch } = useApp();
  const { purchaseOrders, jobs, settings } = state;
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseOrderStatus>(
    "all",
  );
  const [jobFilter, setJobFilter] = useState("all");
  const [overBudgetOnly, setOverBudgetOnly] = useState(false);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Jobs whose cumulative PO spend has exceeded their quoted value.
  const overBudgetJobIds = useMemo(() => {
    const spendByJob = new Map<string, number>();
    for (const o of purchaseOrders) {
      if (!o.job_id) continue;
      spendByJob.set(o.job_id, (spendByJob.get(o.job_id) ?? 0) + o.total_amount);
    }
    const ids = new Set<string>();
    for (const j of jobs) {
      if (j.value != null && j.value > 0 && (spendByJob.get(j.id) ?? 0) > j.value) {
        ids.add(j.id);
      }
    }
    return ids;
  }, [purchaseOrders, jobs]);

  const filtered = useMemo(() => {
    let list = [...purchaseOrders];
    if (statusFilter !== "all")
      list = list.filter((o) => o.status === statusFilter);
    if (jobFilter !== "all") list = list.filter((o) => o.job_id === jobFilter);
    if (overBudgetOnly)
      list = list.filter((o) => o.job_id && overBudgetJobIds.has(o.job_id));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.po_number.toLowerCase().includes(q) ||
          o.supplier.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          (o.job_number ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [purchaseOrders, statusFilter, jobFilter, overBudgetOnly, overBudgetJobIds, search]);

  const totalSpend = purchaseOrders.reduce((s, o) => s + o.total_amount, 0);
  const pendingCount = purchaseOrders.filter(
    (o) => o.status === "draft" || o.status === "ordered",
  ).length;
  const receivedCount = purchaseOrders.filter(
    (o) => o.status === "received",
  ).length;

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(o: PurchaseOrder, e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(o);
    setForm({
      supplier: o.supplier,
      description: o.description,
      jobId: o.job_id ?? "",
      amount: String(o.amount),
      vatAmount: String(o.vat_amount),
      status: o.status,
      orderDate: o.order_date,
      expectedDelivery: o.expected_delivery ?? "",
      deliveryDate: o.delivery_date ?? "",
      notes: o.notes ?? "",
    });
    setShowModal(true);
  }

  function handleAmountBlur() {
    const amt = Number(form.amount || 0);
    if (!form.vatAmount) {
      setForm((f) => ({
        ...f,
        vatAmount: (Math.round(amt * 0.2 * 100) / 100).toFixed(2),
      }));
    }
  }

  async function handleSave() {
    if (!form.supplier.trim() || !form.description.trim() || !form.orderDate) {
      toast.error("Supplier, description and order date are required");
      return;
    }
    setSaving(true);
    try {
      const amount = Number(form.amount || 0);
      const vatAmount = Number(
        form.vatAmount || Math.round(amount * 0.2 * 100) / 100,
      );
      const payload = {
        supplier: form.supplier.trim(),
        description: form.description.trim(),
        jobId: form.jobId || undefined,
        amount,
        vatAmount,
        totalAmount: amount + vatAmount,
        status: form.status,
        orderDate: form.orderDate,
        expectedDelivery: form.expectedDelivery || undefined,
        deliveryDate: form.deliveryDate || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        const res = await fetch(`${BASE}/api/purchase-orders/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        const updated = toPurchaseOrder(await res.json());
        dispatch({
          type: "UPDATE_PURCHASE_ORDER",
          id: editing.id,
          updates: updated,
        });
        if (selected?.id === editing.id) setSelected(updated);
        toast.success("Purchase order updated");
      } else {
        const res = await fetch(`${BASE}/api/purchase-orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        const created = toPurchaseOrder(await res.json());
        dispatch({ type: "ADD_PURCHASE_ORDER", order: created });
        toast.success(`${created.po_number} created`);
      }
      setShowModal(false);
    } catch {
      toast.error("Failed to save purchase order");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(o: PurchaseOrder) {
    if (!confirm(`Delete ${o.po_number}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/api/purchase-orders/${o.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      dispatch({ type: "REMOVE_PURCHASE_ORDER", id: o.id });
      if (selected?.id === o.id) setSelected(null);
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(
    o: PurchaseOrder,
    status: PurchaseOrderStatus,
  ) {
    try {
      const res = await fetch(`${BASE}/api/purchase-orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = toPurchaseOrder(await res.json());
      dispatch({ type: "UPDATE_PURCHASE_ORDER", id: o.id, updates: updated });
      if (selected?.id === o.id) setSelected(updated);
      toast.success(`Status → ${STATUS_CONFIG[status].label}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function downloadPO(o: PurchaseOrder) {
    try {
      const blob = await pdf(
        <PurchaseOrderPDF po={o} company={settings as any} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${o.po_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error("Failed to generate PDF");
    }
  }

  function exportCSV() {
    const header = [
      "PO Number",
      "Supplier",
      "Description",
      "Job",
      "Status",
      "Order Date",
      "Net",
      "VAT",
      "Total",
    ];
    const rows = filtered.map((o) => [
      o.po_number,
      o.supplier,
      o.description,
      o.job_number ?? "",
      o.status,
      o.order_date,
      o.amount.toFixed(2),
      o.vat_amount.toFixed(2),
      o.total_amount.toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "purchase-orders.csv";
    a.click();
  }

  const STATUS_FLOW: PurchaseOrderStatus[] = [
    "draft",
    "ordered",
    "received",
    "invoiced",
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Purchase Orders
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Track material and plant spend against jobs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} /> Export
          </Btn>
          <Btn size="sm" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> New PO
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          accent
          label="Committed Spend"
          value={formatCurrency(totalSpend)}
          sub={`${purchaseOrders.length} orders`}
        />
        <StatCard
          danger={overBudgetJobIds.size > 0}
          label="Over Budget"
          value={overBudgetJobIds.size}
          sub={overBudgetJobIds.size === 1 ? "job over budget" : "jobs over budget"}
          actionLabel={overBudgetJobIds.size > 0 ? "Review" : undefined}
          onAction={() => setOverBudgetOnly(true)}
        />
        <StatCard label="Open Orders" value={pendingCount} sub="draft + ordered" />
        <StatCard label="Received" value={receivedCount} sub="this period" />
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {(
          [
            { id: "all" as const, label: "All" },
            ...(Object.keys(STATUS_CONFIG) as PurchaseOrderStatus[]).map((id) => ({
              id,
              label: STATUS_CONFIG[id].label,
            })),
          ]
        ).map((tab) => {
          const count =
            tab.id === "all"
              ? purchaseOrders.length
              : purchaseOrders.filter((o) => o.status === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className="px-4 py-2.5 text-sm transition-colors whitespace-nowrap flex items-center gap-1.5"
              style={
                statusFilter === tab.id
                  ? {
                      color: "var(--ink)",
                      fontWeight: 600,
                      borderBottom: "2px solid var(--accent)",
                      marginBottom: "-1px",
                    }
                  : { color: "var(--muted)" }
              }
            >
              {tab.label}
              <span
                className="inline-flex items-center justify-center px-1.5 text-[11px] font-bold"
                style={{
                  fontFamily: "var(--font-heading)",
                  backgroundColor:
                    statusFilter === tab.id
                      ? "var(--accent-bg)"
                      : "var(--surface-3)",
                  color:
                    statusFilter === tab.id ? "var(--accent)" : "var(--muted-2)",
                  minWidth: "18px",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm px-3 py-2"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Search
            className="w-3.5 h-3.5 flex-shrink-0"
            strokeWidth={1.5}
            style={{ color: "var(--muted-2)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, supplier, description…"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[var(--muted-2)]"
            style={{ color: "var(--ink)" }}
          />
        </div>
        {overBudgetOnly && (
          <button
            onClick={() => setOverBudgetOnly(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--danger-bg)",
              color: "var(--danger)",
              border: "1px solid rgba(178,58,38,0.3)",
            }}
          >
            Over budget only
            <X className="w-3 h-3" strokeWidth={1.5} />
          </button>
        )}
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="py-2 px-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--ink-2)",
          }}
        >
          <option value="all">All Jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.job_number} — {j.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-6 items-start">
        <Panel noPad className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title={
                purchaseOrders.length === 0
                  ? "No purchase orders yet"
                  : "No purchase orders match this filter"
              }
              description={
                purchaseOrders.length === 0
                  ? "Track material and plant spend against jobs, from order through to invoice."
                  : "Try a different status, job or search term."
              }
              primaryLabel={
                purchaseOrders.length === 0 ? "Create your first purchase order" : undefined
              }
              onPrimary={purchaseOrders.length === 0 ? openAdd : undefined}
              secondaryLabel="Import from spreadsheet"
              onSecondary={() => setLocation("/import")}
            />
          ) : (
            <div>
              {filtered.map((o, i) => {
                const isOverBudget = !!(o.job_id && overBudgetJobIds.has(o.job_id));
                const RowIcon = STATUS_CONFIG[o.status]?.icon ?? Package;
                return (
                  <div
                    key={o.id}
                    onClick={() =>
                      setSelected(selected?.id === o.id ? null : o)
                    }
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--surface-2)] group"
                    style={{
                      borderBottom:
                        i < filtered.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                      backgroundColor:
                        selected?.id === o.id
                          ? "var(--surface-2)"
                          : isOverBudget
                            ? "var(--danger-bg)"
                            : undefined,
                      borderLeft: `3px solid ${isOverBudget ? "var(--danger)" : "transparent"}`,
                    }}
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: "var(--surface-3)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <RowIcon
                        className="w-3.5 h-3.5"
                        strokeWidth={1.5}
                        style={{ color: STATUS_CONFIG[o.status]?.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span
                          className="text-sm font-mono font-semibold"
                          style={{ color: "var(--accent)" }}
                        >
                          {o.po_number}
                        </span>
                        <span
                          className="text-sm font-semibold truncate"
                          style={{ color: "var(--ink)" }}
                        >
                          {o.supplier}
                        </span>
                        {isOverBudget && (
                          <AlertCircle
                            className="w-3.5 h-3.5 flex-shrink-0"
                            strokeWidth={1.5}
                            style={{ color: "var(--danger)" }}
                          />
                        )}
                      </div>
                      <div
                        className="text-xs flex items-center gap-2 flex-wrap"
                        style={{ color: "var(--muted)" }}
                      >
                        <span className="truncate">
                          {o.description.length > 50
                            ? o.description.slice(0, 50) + "…"
                            : o.description}
                        </span>
                        {o.job_number && (
                          <>
                            <span>&middot;</span>
                            <span
                              className="font-mono font-bold px-1.5 py-0.5"
                              style={{
                                backgroundColor: "var(--surface-2)",
                                color: "var(--ink-2)",
                              }}
                            >
                              {o.job_number}
                            </span>
                          </>
                        )}
                        <span>&middot;</span>
                        <span className="font-mono tnum">{formatDate(o.order_date)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={o.status} />
                      <div
                        className="text-sm font-mono font-semibold tnum text-right"
                        style={{ color: "var(--ink)", minWidth: "80px" }}
                      >
                        {formatCurrency(o.total_amount)}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => openEdit(o, e)}
                          className="p-1.5 hover:bg-[var(--border)] transition-colors"
                          title="Edit"
                        >
                          <Pencil
                            className="w-3 h-3"
                            strokeWidth={1.5}
                            style={{ color: "var(--muted)" }}
                          />
                        </button>
                        <ChevronRight
                          className="w-3.5 h-3.5"
                          strokeWidth={1.5}
                          style={{ color: "var(--muted-2)" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div
                className="flex items-center justify-between px-5 py-2.5"
                style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
              >
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--muted)" }}
                >
                  Total ({filtered.length})
                </span>
                <span
                  className="text-sm font-mono font-bold tnum"
                  style={{ color: "var(--ink)" }}
                >
                  {formatCurrency(filtered.reduce((s, o) => s + o.total_amount, 0))}
                </span>
              </div>
            </div>
          )}
        </Panel>

        {selected && (
          <div className="w-80 flex-shrink-0 space-y-4">
            <Panel>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    Purchase Order
                  </div>
                  <div
                    className="text-lg font-bold font-mono"
                    style={{
                      color: "var(--accent)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {selected.po_number}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 hover:bg-[var(--surface-2)]"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} style={{ color: "var(--muted-2)" }} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className="p-3"
                  style={{ backgroundColor: "var(--bg)" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    Net
                  </div>
                  <div
                    className="text-base font-mono font-bold tnum"
                    style={{ color: "var(--ink)" }}
                  >
                    {formatCurrency(selected.amount)}
                  </div>
                </div>
                <div
                  className="p-3"
                  style={{ backgroundColor: "var(--bg)" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    VAT
                  </div>
                  <div
                    className="text-base font-mono font-bold tnum"
                    style={{ color: "var(--ink)" }}
                  >
                    {formatCurrency(selected.vat_amount)}
                  </div>
                </div>
                <div
                  className="col-span-2 p-3"
                  style={{ backgroundColor: "var(--accent-bg)" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--accent)" }}
                  >
                    Total (inc. VAT)
                  </div>
                  <div
                    className="text-xl font-mono font-bold tnum"
                    style={{ color: "var(--accent)" }}
                  >
                    {formatCurrency(selected.total_amount)}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--muted)" }}>Supplier</span>
                  <span className="font-medium" style={{ color: "var(--ink)" }}>
                    {selected.supplier}
                  </span>
                </div>
                {selected.job_number && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--muted)" }}>Job</span>
                    <span
                      className="font-mono text-xs font-bold px-2 py-0.5"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-2)" }}
                    >
                      {selected.job_number}{" "}
                      {selected.job_title && `— ${selected.job_title}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--muted)" }}>Ordered</span>
                  <span style={{ color: "var(--ink)" }}>
                    {formatDate(selected.order_date)}
                  </span>
                </div>
                {selected.expected_delivery && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--muted)" }}>Expected</span>
                    <span style={{ color: "var(--ink)" }}>
                      {formatDate(selected.expected_delivery)}
                    </span>
                  </div>
                )}
                {selected.delivery_date && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--muted)" }}>Delivered</span>
                    <span className="font-medium" style={{ color: "var(--success)" }}>
                      {formatDate(selected.delivery_date)}
                    </span>
                  </div>
                )}
              </div>

              {selected.description && (
                <div
                  className="p-3 mb-4"
                  style={{ backgroundColor: "var(--bg)" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    Description
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {selected.description}
                  </p>
                </div>
              )}

              {selected.notes && (
                <div
                  className="p-3 mb-4"
                  style={{ backgroundColor: "var(--bg)" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    Notes
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {selected.notes}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <div
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "var(--muted)" }}
                >
                  Move Status
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FLOW.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selected, s)}
                      className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all"
                      style={
                        selected.status === s
                          ? {
                              backgroundColor: STATUS_CONFIG[s].bg,
                              color: STATUS_CONFIG[s].color,
                              border: `1.5px solid ${STATUS_CONFIG[s].color}`,
                            }
                          : {
                              backgroundColor: "var(--surface-2)",
                              color: "var(--muted)",
                              border: "1.5px solid transparent",
                            }
                      }
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="flex gap-2 pt-3"
                style={{ borderTop: "1px solid var(--surface-3)" }}
              >
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPO(selected)}
                  title="Download PDF"
                >
                  <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Btn>
                <Btn
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => openEdit(selected, e as any)}
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} /> Edit
                </Btn>
                <Btn
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(selected)}
                  disabled={deleting}
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Btn>
              </div>
            </Panel>
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(24,20,16,0.5)" }}
        >
          <div
            className="w-full max-w-lg shadow-2xl overflow-hidden"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid var(--surface-3)" }}
            >
              <h2
                className="text-base font-semibold"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {editing ? `Edit ${editing.po_number}` : "New Purchase Order"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-[var(--surface-2)]"
              >
                <X className="w-4 h-4" strokeWidth={1.5} style={{ color: "var(--muted)" }} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Supplier *
                  </label>
                  <input
                    value={form.supplier}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplier: e.target.value }))
                    }
                    placeholder="e.g. Aggregates Direct"
                    className="w-full px-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Description *
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="e.g. 20 tonne MOT Type 1 sub-base"
                    className="w-full px-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Net Amount (£)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    onBlur={handleAmountBlur}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm font-mono focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    VAT (£)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.vatAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, vatAmount: e.target.value }))
                    }
                    placeholder="auto-calc"
                    className="w-full px-3 py-2 text-sm font-mono focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  />
                  {form.amount && (
                    <p
                      className="text-[11px] mt-1 font-mono"
                      style={{ color: "var(--muted)" }}
                    >
                      Total:{" "}
                      {formatCurrency(
                        (Number(form.amount) || 0) +
                          (Number(form.vatAmount) || 0),
                      )}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as PurchaseOrderStatus,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Order Date *
                  </label>
                  <input
                    type="date"
                    value={form.orderDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, orderDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Expected Delivery
                  </label>
                  <input
                    type="date"
                    value={form.expectedDelivery}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        expectedDelivery: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={form.deliveryDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, deliveryDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Job (optional)
                  </label>
                  <select
                    value={form.jobId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, jobId: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  >
                    <option value="">No job assigned</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.job_number} — {j.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Notes
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                    placeholder="Delivery instructions, reference numbers…"
                    className="w-full px-3 py-2 text-sm focus:outline-none resize-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              className="flex gap-3 px-6 py-4"
              style={{ borderTop: "1px solid var(--surface-3)" }}
            >
              <Btn
                variant="outline"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Btn>
              <Btn className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Create PO"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
