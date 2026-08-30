import { useState } from "react";
import {
  Plus,
  Search,
  AlertTriangle,
  X,
  ChevronRight,
  Trash2,
  Pencil,
  HardHat,
} from "lucide-react";
import { useLocation } from "wouter";
import { Panel } from "../components/ui/Panel";
import { Badge } from "../components/ui/Badge";
import { Btn } from "../components/ui/Btn";
import { StatCard } from "../components/ui/StatCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal, Field, Input, Select, Textarea } from "../components/ui/Modal";
import { cn, formatDate, daysUntil } from "../lib/utils";
import { useApp } from "../store/AppContext";
import {
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
} from "@workspace/api-client-react";
import { toSubcontractor } from "../lib/apiTransforms";
import { toast } from "sonner";
import type { CISStatus, Subcontractor } from "../types";

const CIS_STATUSES: CISStatus[] = ["gross", "net", "unverified"];

const emptyForm = {
  company_name: "",
  contact_name: "",
  trade: "",
  email: "",
  phone: "",
  utr_number: "",
  cis_status: "net" as CISStatus,
  nrswa_card_number: "",
  public_liability_expiry: "",
  cscs_card_expiry: "",
  nrswa_expiry: "",
  notes: "",
};

export function SubcontractorsPage() {
  const { state, dispatch } = useApp();
  const { subcontractors } = state;
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "active" | "inactive">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filtered = subcontractors.filter((s) => {
    if (tab === "active" && !s.active) return false;
    if (tab === "inactive" && s.active) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.company_name.toLowerCase().includes(q) ||
      (s.contact_name ?? "").toLowerCase().includes(q) ||
      (s.trade ?? "").toLowerCase().includes(q)
    );
  });

  const selectedSub = selected
    ? subcontractors.find((s) => s.id === selected)
    : null;

  function getDocWarnings(sub: (typeof subcontractors)[0]) {
    const warnings: string[] = [];
    const plDays = daysUntil(sub.public_liability_expiry);
    if (plDays !== null && plDays <= 30)
      warnings.push(
        `PL Insurance ${plDays <= 0 ? "EXPIRED" : `expires in ${plDays}d`}`,
      );
    const nrswaDays = daysUntil(sub.nrswa_expiry);
    if (sub.nrswa_card_number && nrswaDays !== null && nrswaDays <= 60)
      warnings.push(
        `NRSWA ${nrswaDays <= 0 ? "EXPIRED" : `expires in ${nrswaDays}d`}`,
      );
    const cscsDays = daysUntil(sub.cscs_card_expiry);
    if (cscsDays !== null && cscsDays <= 30)
      warnings.push(
        `CSCS ${cscsDays <= 0 ? "EXPIRED" : `expires in ${cscsDays}d`}`,
      );
    return warnings;
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(sub: Subcontractor) {
    setEditingId(sub.id);
    setForm({
      company_name: sub.company_name,
      contact_name: sub.contact_name ?? "",
      trade: sub.trade ?? "",
      email: sub.email ?? "",
      phone: sub.phone ?? "",
      utr_number: sub.utr_number ?? "",
      cis_status: sub.cis_status,
      nrswa_card_number: sub.nrswa_card_number ?? "",
      public_liability_expiry: sub.public_liability_expiry ?? "",
      cscs_card_expiry: sub.cscs_card_expiry ?? "",
      nrswa_expiry: sub.nrswa_expiry ?? "",
      notes: sub.notes ?? "",
    });
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.company_name.trim()) e.company_name = "Company name is required";
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
      const deductionRate =
        form.cis_status === "gross" ? 0 : form.cis_status === "net" ? 20 : 30;
      if (editingId) {
        const result = await updateSubcontractor(editingId, {
          companyName: form.company_name.trim(),
          contactName: form.contact_name || undefined,
          trade: form.trade || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          utrNumber: form.utr_number || undefined,
          cisStatus: form.cis_status,
          cisDeductionRate: deductionRate,
          nrswaCardNumber: form.nrswa_card_number || undefined,
          nrswaExpiry: form.nrswa_expiry || undefined,
          publicLiabilityExpiry: form.public_liability_expiry || undefined,
          cscsCardExpiry: form.cscs_card_expiry || undefined,
          notes: form.notes || undefined,
        });
        dispatch({
          type: "UPDATE_SUBCONTRACTOR",
          id: editingId,
          updates: toSubcontractor(result),
        });
        setShowModal(false);
        toast.success("Subcontractor updated");
      } else {
        const result = await createSubcontractor({
          companyName: form.company_name.trim(),
          contactName: form.contact_name || undefined,
          trade: form.trade || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          utrNumber: form.utr_number || undefined,
          cisStatus: form.cis_status,
          cisDeductionRate: deductionRate,
          nrswaCardNumber: form.nrswa_card_number || undefined,
          nrswaExpiry: form.nrswa_expiry || undefined,
          publicLiabilityExpiry: form.public_liability_expiry || undefined,
          cscsCardExpiry: form.cscs_card_expiry || undefined,
          notes: form.notes || undefined,
        } as any);
        dispatch({ type: "ADD_SUBCONTRACTOR", sub: toSubcontractor(result) });
        setShowModal(false);
        toast.success(`${result.companyName} added`);
      }
    } catch {
      toast.error(
        editingId
          ? "Failed to update subcontractor"
          : "Failed to add subcontractor",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await deleteSubcontractor(id);
      dispatch({ type: "REMOVE_SUBCONTRACTOR", id });
      setSelected(null);
      toast.success(`${name} deleted`);
    } catch {
      toast.error("Failed to delete subcontractor");
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{
              color: "var(--ink)",
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            Subcontractors
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            CIS, compliance and document tracking
          </p>
        </div>
        <Btn onClick={openNew}>
          <Plus className="w-4 h-4" /> Add Subcontractor
        </Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          accent
          label="Active"
          value={subcontractors.filter((s) => s.active).length}
          sub="Registered subbies"
        />
        <StatCard
          label="Gross"
          value={subcontractors.filter((s) => s.cis_status === "gross").length}
          sub="0% deduction"
        />
        <StatCard
          label="Net 20%"
          value={subcontractors.filter((s) => s.cis_status === "net").length}
          sub="Standard deduction"
        />
        <StatCard
          danger={
            subcontractors.filter((s) => s.cis_status === "unverified").length >
            0
          }
          label="Unverified"
          value={
            subcontractors.filter((s) => s.cis_status === "unverified").length
          }
          sub="Higher 30% rate"
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
        <div
          className="flex items-center gap-1"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {(["all", "active", "inactive"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm capitalize transition-colors"
              style={
                tab === t
                  ? {
                      color: "var(--ink)",
                      fontWeight: 600,
                      borderBottom: "2px solid var(--accent)",
                      marginBottom: "-1px",
                    }
                  : { color: "var(--muted)", fontWeight: 500 }
              }
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--muted-2)" }}
          />
          <input
            type="text"
            placeholder="Search subcontractors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg text-sm w-full sm:w-64 focus:outline-none transition-colors"
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
        <div
          className={
            selectedSub ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"
          }
        >
          <Panel noPad>
            {filtered.length === 0 ? (
              <p
                className="text-center py-12 text-sm"
                style={{ color: "var(--muted-2)" }}
              >
                No subcontractors found
              </p>
            ) : (
              filtered.map((sub, i) => {
                const warnings = getDocWarnings(sub);
                return (
                  <div
                    key={sub.id}
                    onClick={() =>
                      setSelected(selected === sub.id ? null : sub.id)
                    }
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer group transition-colors hover:bg-[var(--surface-2)]"
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      backgroundColor:
                        selected === sub.id ? "var(--surface-2)" : undefined,
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors"
                      style={{
                        backgroundColor:
                          selected === sub.id ? "var(--accent)" : "var(--surface-3)",
                        color: selected === sub.id ? "#ffffff" : "var(--muted-2)",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {sub.company_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-sm font-semibold truncate transition-colors group-hover:text-[var(--accent)]"
                          style={{ color: "var(--ink)" }}
                        >
                          {sub.company_name}
                        </span>
                        {warnings.length > 0 && (
                          <AlertTriangle
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: "var(--warning)" }}
                          />
                        )}
                      </div>
                      <div
                        className="text-[13px] flex items-center gap-2"
                        style={{ color: "var(--muted)" }}
                      >
                        <span className="truncate">{sub.trade ?? "—"}</span>
                        <span
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: "var(--border)" }}
                        />
                        <span className="truncate">
                          {sub.contact_name ?? "—"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <Badge status={sub.cis_status} />
                      {sub.nrswa_card_number && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded hidden md:block font-bold uppercase tracking-wider"
                          style={{
                            color: "var(--accent)",
                            backgroundColor: "rgba(27,94,120,0.1)",
                          }}
                        >
                          NRSWA
                        </span>
                      )}
                      <div
                        className="text-xs text-right hidden xl:block font-mono tnum w-28"
                        style={{ color: "var(--muted)" }}
                      >
                        {sub.utr_number ? sub.utr_number : "—"}
                      </div>
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 flex-shrink-0 transition-opacity",
                          selected === sub.id
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100",
                        )}
                        style={{ color: "var(--muted)" }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </Panel>
        </div>

        {selectedSub && (
          <div className="space-y-6">
            <Panel
              actions={
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(selectedSub)}
                    className="p-1 rounded hover:bg-[var(--surface-3)] transition-colors"
                    style={{ color: "var(--muted)" }}
                    title="Edit subcontractor"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      handleDelete(selectedSub.id, selectedSub.company_name)
                    }
                    className="p-1 rounded hover:bg-red-50 transition-colors"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded hover:bg-[var(--surface-3)] transition-colors"
                    style={{ color: "var(--muted)" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              }
            >
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge status={selectedSub.cis_status} />
                    {!selectedSub.active && (
                      <span
                        className="text-[11px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--danger)" }}
                      >
                        Inactive
                      </span>
                    )}
                  </div>
                  <h3
                    className="text-lg font-semibold"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {selectedSub.company_name}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                    {selectedSub.trade ?? "—"}
                  </p>
                </div>

                <div
                  className="space-y-3 pt-4"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    Contact Details
                  </p>
                  {[
                    {
                      label: "Contact",
                      value: selectedSub.contact_name ?? "—",
                      isMono: false,
                    },
                    {
                      label: "Phone",
                      value: selectedSub.phone ?? "—",
                      isMono: true,
                    },
                    {
                      label: "Email",
                      value: selectedSub.email ?? "—",
                      isMono: false,
                    },
                  ].map(({ label, value, isMono }) => (
                    <div
                      key={label}
                      className="flex justify-between items-center gap-3 text-[13px]"
                    >
                      <span
                        className="flex-shrink-0"
                        style={{ color: "var(--muted)" }}
                      >
                        {label}
                      </span>
                      <span
                        className={cn(
                          "text-right truncate",
                          isMono && "font-mono tnum",
                        )}
                        style={{ color: "var(--ink)", fontWeight: 500 }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  className="p-4 rounded-xl"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: "var(--muted)" }}
                  >
                    CIS Details
                  </p>
                  {[
                    {
                      label: "UTR Number",
                      value: selectedSub.utr_number ?? "—",
                    },
                    {
                      label: "CIS Status",
                      value: selectedSub.cis_status.toUpperCase(),
                    },
                    {
                      label: "Deduction Rate",
                      value: `${selectedSub.cis_deduction_rate}%`,
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between text-[13px] mb-2 last:mb-0"
                    >
                      <span style={{ color: "var(--muted)" }}>{label}</span>
                      <span
                        className="font-mono tnum font-semibold"
                        style={{ color: "var(--ink)" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: "var(--muted)" }}
                  >
                    Compliance & Documents
                  </p>
                  {[
                    { label: "NRSWA Card", expiry: selectedSub.nrswa_expiry },
                    {
                      label: "Public Liability",
                      expiry: selectedSub.public_liability_expiry,
                    },
                    {
                      label: "CSCS Card",
                      expiry: selectedSub.cscs_card_expiry,
                    },
                  ].map(({ label, expiry }) => {
                    const days = daysUntil(expiry);
                    const isExpiring = days !== null && days <= 30 && days > 0;
                    const isExpired = days !== null && days <= 0;
                    return (
                      <div
                        key={label}
                        className="flex justify-between items-center py-2.5 text-[13px]"
                        style={{ borderBottom: "1px solid var(--surface-2)" }}
                      >
                        <span style={{ color: "var(--ink-2)" }}>{label}</span>
                        <span
                          className="font-mono tnum text-xs font-semibold"
                          style={{
                            color: isExpired
                              ? "var(--danger)"
                              : isExpiring
                                ? "var(--warning)"
                                : expiry
                                  ? "#2a6e45"
                                  : "var(--muted-2)",
                          }}
                        >
                          {expiry ? formatDate(expiry) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {getDocWarnings(selectedSub).length > 0 && (
                  <div
                    className="p-3 rounded-lg space-y-2 mt-2"
                    style={{
                      backgroundColor: "rgba(178,58,38,0.05)",
                      border: "1px solid rgba(178,58,38,0.2)",
                    }}
                  >
                    {getDocWarnings(selectedSub).map((w) => (
                      <div
                        key={w}
                        className="flex items-center gap-2 text-[13px] font-medium"
                        style={{ color: "var(--danger)" }}
                      >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Edit Subcontractor" : "Add Subcontractor"}
      >
        <div className="space-y-5">
          <Field label="Company Name" required>
            <Input
              value={form.company_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, company_name: e.target.value }))
              }
              placeholder="e.g. Smith Groundworks Ltd"
            />
            {errors.company_name && (
              <p
                className="mt-1 text-xs font-medium"
                style={{ color: "var(--danger)" }}
              >
                {errors.company_name}
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name">
              <Input
                value={form.contact_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_name: e.target.value }))
                }
                placeholder="e.g. Mike Smith"
              />
            </Field>
            <Field label="Trade">
              <Input
                value={form.trade}
                onChange={(e) =>
                  setForm((f) => ({ ...f, trade: e.target.value }))
                }
                placeholder="e.g. Drainage, Piling"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <Input
                className="font-mono"
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="07700 900000"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="mike@smith.co.uk"
              />
            </Field>
          </div>
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-4"
              style={{ color: "var(--muted)" }}
            >
              CIS Details
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="UTR Number">
                <Input
                  className="font-mono"
                  value={form.utr_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, utr_number: e.target.value }))
                  }
                  placeholder="1234567890"
                />
              </Field>
              <Field label="CIS Status">
                <Select
                  value={form.cis_status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cis_status: e.target.value as CISStatus,
                    }))
                  }
                >
                  {CIS_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                      {s === "net"
                        ? " (20%)"
                        : s === "unverified"
                          ? " (30%)"
                          : " (0%)"}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-4 mt-2"
              style={{ color: "var(--muted)" }}
            >
              Compliance Expiry Dates
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="NRSWA Card No">
                <Input
                  className="font-mono"
                  value={form.nrswa_card_number}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      nrswa_card_number: e.target.value,
                    }))
                  }
                  placeholder="Card number"
                />
              </Field>
              <Field label="NRSWA Expiry">
                <Input
                  className="font-mono"
                  type="date"
                  value={form.nrswa_expiry}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nrswa_expiry: e.target.value }))
                  }
                />
              </Field>
              <Field label="PL Insurance Expiry">
                <Input
                  className="font-mono"
                  type="date"
                  value={form.public_liability_expiry}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      public_liability_expiry: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="CSCS Card Expiry">
                <Input
                  className="font-mono"
                  type="date"
                  value={form.cscs_card_expiry}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cscs_card_expiry: e.target.value }))
                  }
                />
              </Field>
            </div>
          </div>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Any relevant notes..."
              rows={3}
            />
          </Field>
          <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
            <Btn
              className="flex-1 justify-center"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving
                ? editingId
                  ? "Saving…"
                  : "Adding…"
                : editingId
                  ? "Save Changes"
                  : "Add Subcontractor"}
            </Btn>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
