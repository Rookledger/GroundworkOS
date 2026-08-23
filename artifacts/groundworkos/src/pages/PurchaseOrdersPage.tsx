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
import { useApp } from "../store/AppContext";
import { Btn } from "../components/ui/Btn";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
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
  draft: { label: "Draft", color: "#7a7469", bg: "#eeeae4", icon: AlertCircle },
  ordered: {
    label: "Ordered",
    color: "#b56918",
    bg: "#fef3c7",
    icon: ShoppingCart,
  },
  received: {
    label: "Received",
    color: "#2a6e45",
    bg: "rgba(42,110,69,0.1)",
    icon: Package,
  },
  invoiced: {
    label: "Invoiced",
    color: "#1b5e78",
    bg: "#e8f3f7",
    icon: FileCheck,
  },
};

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {status === "ordered" && <Truck className="w-3 h-3" />}
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseOrderStatus>(
    "all",
  );
  const [jobFilter, setJobFilter] = useState("all");
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    let list = [...purchaseOrders];
    if (statusFilter !== "all")
      list = list.filter((o) => o.status === statusFilter);
    if (jobFilter !== "all") list = list.filter((o) => o.job_id === jobFilter);
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
  }, [purchaseOrders, statusFilter, jobFilter, search]);

  const totalSpend = purchaseOrders.reduce((s, o) => s + o.total_amount, 0);
  const orderedSpend = purchaseOrders
    .filter((o) => o.status === "ordered")
    .reduce((s, o) => s + o.total_amount, 0);
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
        jobId: form.jobId || null,
        amount,
        vatAmount,
        totalAmount: amount + vatAmount,
        status: form.status,
        orderDate: form.orderDate,
        expectedDelivery: form.expectedDelivery || null,
        deliveryDate: form.deliveryDate || null,
        notes: form.notes.trim() || null,
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
              color: "#181410",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Purchase Orders
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#7a7469" }}>
            Track material and plant spend against jobs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5" /> Export
          </Btn>
          <Btn size="sm" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" /> New PO
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          accent
          label="Total Spend"
          value={formatCurrency(totalSpend)}
          sub={`${purchaseOrders.length} orders`}
        />
        <StatCard
          label="On Order"
          value={formatCurrency(orderedSpend)}
          sub="awaiting delivery"
        />
        <StatCard label="Pending" value={pendingCount} sub="draft + ordered" />
        <StatCard label="Received" value={receivedCount} sub="this period" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div
          className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm px-3 py-2 rounded-lg"
          style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
        >
          <Search
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: "#a8a099" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, supplier, description…"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[#a8a099]"
            style={{ color: "#181410" }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="py-2 px-3 rounded-lg text-sm focus:outline-none"
          style={{
            backgroundColor: "#fafaf8",
            border: "1px solid #d9d4ce",
            color: "#4a4540",
          }}
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="py-2 px-3 rounded-lg text-sm focus:outline-none"
          style={{
            backgroundColor: "#fafaf8",
            border: "1px solid #d9d4ce",
            color: "#4a4540",
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
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ShoppingCart className="w-8 h-8" style={{ color: "#d9d4ce" }} />
              <p className="text-sm font-medium" style={{ color: "#7a7469" }}>
                No purchase orders found
              </p>
              <Btn size="sm" onClick={openAdd}>
                <Plus className="w-3.5 h-3.5" /> Create your first PO
              </Btn>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #d9d4ce",
                      backgroundColor: "#fafaf8",
                    }}
                  >
                    {[
                      "PO Number",
                      "Supplier",
                      "Description",
                      "Job",
                      "Status",
                      "Order Date",
                      "Total",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "#7a7469" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o, i) => (
                    <tr
                      key={o.id}
                      onClick={() =>
                        setSelected(selected?.id === o.id ? null : o)
                      }
                      className="cursor-pointer transition-colors hover:bg-[#eeeae4] group"
                      style={{
                        borderBottom:
                          i < filtered.length - 1
                            ? "1px solid #e8e4dd"
                            : "none",
                        backgroundColor:
                          selected?.id === o.id ? "#eeeae4" : undefined,
                      }}
                    >
                      <td className="py-3 px-4">
                        <span
                          className="text-sm font-mono font-semibold"
                          style={{ color: "#1b5e78" }}
                        >
                          {o.po_number}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="text-sm font-medium"
                          style={{ color: "#181410" }}
                        >
                          {o.supplier}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm" style={{ color: "#4a4540" }}>
                          {o.description.length > 40
                            ? o.description.slice(0, 40) + "…"
                            : o.description}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {o.job_number ? (
                          <span
                            className="text-[11px] font-mono font-bold px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: "#eeeae4",
                              color: "#4a4540",
                            }}
                          >
                            {o.job_number}
                          </span>
                        ) : (
                          <span style={{ color: "#d9d4ce" }}>—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={o.status} />
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono"
                        style={{ color: "#7a7469" }}
                      >
                        {formatDate(o.order_date)}
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono font-semibold tnum text-right"
                        style={{ color: "#181410" }}
                      >
                        {formatCurrency(o.total_amount)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => openEdit(o, e)}
                            className="p-1.5 rounded hover:bg-[#d9d4ce] transition-colors"
                            title="Edit"
                          >
                            <Pencil
                              className="w-3 h-3"
                              style={{ color: "#7a7469" }}
                            />
                          </button>
                          <ChevronRight
                            className="w-3.5 h-3.5"
                            style={{ color: "#a8a099" }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      borderTop: "1px solid #d9d4ce",
                      backgroundColor: "#fafaf8",
                    }}
                  >
                    <td
                      colSpan={6}
                      className="py-2.5 px-4 text-xs font-bold uppercase tracking-widest text-right"
                      style={{ color: "#7a7469" }}
                    >
                      Total ({filtered.length})
                    </td>
                    <td
                      className="py-2.5 px-4 text-sm font-mono font-bold tnum text-right"
                      style={{ color: "#181410" }}
                    >
                      {formatCurrency(
                        filtered.reduce((s, o) => s + o.total_amount, 0),
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
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
                    style={{ color: "#7a7469" }}
                  >
                    Purchase Order
                  </div>
                  <div
                    className="text-lg font-bold font-mono"
                    style={{
                      color: "#1b5e78",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {selected.po_number}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 rounded hover:bg-[#eeeae4]"
                >
                  <X className="w-4 h-4" style={{ color: "#a8a099" }} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: "#f0ede8" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "#7a7469" }}
                  >
                    Net
                  </div>
                  <div
                    className="text-base font-mono font-bold tnum"
                    style={{ color: "#181410" }}
                  >
                    {formatCurrency(selected.amount)}
                  </div>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: "#f0ede8" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "#7a7469" }}
                  >
                    VAT
                  </div>
                  <div
                    className="text-base font-mono font-bold tnum"
                    style={{ color: "#181410" }}
                  >
                    {formatCurrency(selected.vat_amount)}
                  </div>
                </div>
                <div
                  className="col-span-2 p-3 rounded-lg"
                  style={{ backgroundColor: "#e8f3f7" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "#1b5e78" }}
                  >
                    Total (inc. VAT)
                  </div>
                  <div
                    className="text-xl font-mono font-bold tnum"
                    style={{ color: "#1b5e78" }}
                  >
                    {formatCurrency(selected.total_amount)}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span style={{ color: "#7a7469" }}>Supplier</span>
                  <span className="font-medium" style={{ color: "#181410" }}>
                    {selected.supplier}
                  </span>
                </div>
                {selected.job_number && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: "#7a7469" }}>Job</span>
                    <span
                      className="font-mono text-xs font-bold px-2 py-0.5 rounded"
                      style={{ backgroundColor: "#eeeae4", color: "#4a4540" }}
                    >
                      {selected.job_number}{" "}
                      {selected.job_title && `— ${selected.job_title}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span style={{ color: "#7a7469" }}>Ordered</span>
                  <span style={{ color: "#181410" }}>
                    {formatDate(selected.order_date)}
                  </span>
                </div>
                {selected.expected_delivery && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: "#7a7469" }}>Expected</span>
                    <span style={{ color: "#181410" }}>
                      {formatDate(selected.expected_delivery)}
                    </span>
                  </div>
                )}
                {selected.delivery_date && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: "#7a7469" }}>Delivered</span>
                    <span className="font-medium" style={{ color: "#2a6e45" }}>
                      {formatDate(selected.delivery_date)}
                    </span>
                  </div>
                )}
              </div>

              {selected.description && (
                <div
                  className="p-3 rounded-lg mb-4"
                  style={{ backgroundColor: "#f0ede8" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "#7a7469" }}
                  >
                    Description
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#4a4540" }}
                  >
                    {selected.description}
                  </p>
                </div>
              )}

              {selected.notes && (
                <div
                  className="p-3 rounded-lg mb-4"
                  style={{ backgroundColor: "#f0ede8" }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "#7a7469" }}
                  >
                    Notes
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#4a4540" }}
                  >
                    {selected.notes}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <div
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "#7a7469" }}
                >
                  Move Status
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FLOW.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selected, s)}
                      className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                      style={
                        selected.status === s
                          ? {
                              backgroundColor: STATUS_CONFIG[s].bg,
                              color: STATUS_CONFIG[s].color,
                              border: `1.5px solid ${STATUS_CONFIG[s].color}`,
                            }
                          : {
                              backgroundColor: "#eeeae4",
                              color: "#7a7469",
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
                style={{ borderTop: "1px solid #e8e4dd" }}
              >
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPO(selected)}
                  title="Download PDF"
                >
                  <FileText className="w-3.5 h-3.5" />
                </Btn>
                <Btn
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => openEdit(selected, e as any)}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Btn>
                <Btn
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(selected)}
                  disabled={deleting}
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
            className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid #e8e4dd" }}
            >
              <h2
                className="text-base font-semibold"
                style={{
                  color: "#181410",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {editing ? `Edit ${editing.po_number}` : "New Purchase Order"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded hover:bg-[#eeeae4]"
              >
                <X className="w-4 h-4" style={{ color: "#7a7469" }} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "#7a7469" }}
                  >
                    Supplier *
                  </label>
                  <input
                    value={form.supplier}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplier: e.target.value }))
                    }
                    placeholder="e.g. Aggregates Direct"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "#7a7469" }}
                  >
                    Description *
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="e.g. 20 tonne MOT Type 1 sub-base"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "#7a7469" }}
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
                    className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "#7a7469" }}
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
                    className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
                    }}
                  />
                  {form.amount && (
                    <p
                      className="text-[11px] mt-1 font-mono"
                      style={{ color: "#7a7469" }}
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
                    style={{ color: "#7a7469" }}
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
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
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
                    style={{ color: "#7a7469" }}
                  >
                    Order Date *
                  </label>
                  <input
                    type="date"
                    value={form.orderDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, orderDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "#7a7469" }}
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
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "#7a7469" }}
                  >
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={form.deliveryDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, deliveryDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <label
                    className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "#7a7469" }}
                  >
                    Job (optional)
                  </label>
                  <select
                    value={form.jobId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, jobId: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
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
                    style={{ color: "#7a7469" }}
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
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #d9d4ce",
                      color: "#181410",
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              className="flex gap-3 px-6 py-4"
              style={{ borderTop: "1px solid #e8e4dd" }}
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
