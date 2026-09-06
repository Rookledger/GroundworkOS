import { useState } from "react";
import {
  Plus,
  ShieldAlert,
  X,
  ChevronRight,
  Trash2,
  UserCheck,
  Check,
} from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { Badge } from "../components/ui/Badge";
import { Btn } from "../components/ui/Btn";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal, Field, Input, Select, Textarea } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { formatDate, daysUntil } from "../lib/utils";
import { useApp } from "../store/AppContext";
import { useRole, isAtLeast } from "../hooks/useRole";
import {
  createRamsRecord,
  updateRamsRecord,
  deleteRamsRecord,
  acknowledgeRams,
} from "@workspace/api-client-react";
import { toRamsRecord } from "../lib/apiTransforms";
import { toast } from "sonner";
import type { RamsRecord, RamsRiskLevel, RamsStatus } from "../types";

const RISK_LEVELS: RamsRiskLevel[] = ["low", "medium", "high"];
const STATUSES: RamsStatus[] = ["draft", "active", "archived"];

const emptyHazard = { hazard: "", whoAtRisk: "", controls: "", riskBefore: "", riskAfter: "" };

const emptyForm = {
  jobId: "",
  title: "",
  activity: "",
  riskLevel: "medium" as RamsRiskLevel,
  reviewDate: "",
  ppe: "",
  notes: "",
  hazards: [{ ...emptyHazard }],
};

export function RamsPage() {
  const { state, dispatch } = useApp();
  const { rams, jobs } = state;
  const role = useRole();
  const canManage = isAtLeast(role, "manager");

  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [signName, setSignName] = useState("");
  const [signRole, setSignRole] = useState("");
  const [signing, setSigning] = useState(false);

  const filtered = rams.filter(
    (r) => statusFilter === "all" || r.status === statusFilter,
  );
  const selectedRams = selected ? rams.find((r) => r.id === selected) : null;

  const STATUS_OPTIONS = [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "active", label: "Active" },
    { id: "archived", label: "Archived" },
  ];

  function reviewInfo(r: RamsRecord) {
    const days = daysUntil(r.review_date);
    if (days === null) return null;
    if (days <= 0) return { label: `Review overdue by ${Math.abs(days)}d`, danger: true };
    if (days <= 14) return { label: `Review due in ${days}d`, danger: false };
    return null;
  }

  function openNew() {
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.activity.trim()) e.activity = "Activity is required";
    return e;
  }

  function updateHazard(idx: number, field: keyof typeof emptyHazard, value: string) {
    setForm((f) => ({
      ...f,
      hazards: f.hazards.map((h, i) => (i === idx ? { ...h, [field]: value } : h)),
    }));
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSaving(true);
    try {
      const result = await createRamsRecord({
        jobId: form.jobId || undefined,
        title: form.title.trim(),
        activity: form.activity.trim(),
        riskLevel: form.riskLevel,
        reviewDate: form.reviewDate || undefined,
        notes: form.notes || undefined,
        ppe: form.ppe
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        hazards: form.hazards
          .filter((h) => h.hazard.trim())
          .map((h) => ({
            hazard: h.hazard.trim(),
            whoAtRisk: h.whoAtRisk || undefined,
            controls: h.controls || undefined,
            riskBefore: h.riskBefore || undefined,
            riskAfter: h.riskAfter || undefined,
          })),
      });
      dispatch({ type: "ADD_RAMS", rams: toRamsRecord(result) });
      setShowModal(false);
      toast.success(`${result.title} created`);
    } catch {
      toast.error("Failed to create RAMS record");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: RamsStatus) {
    const prev = rams.find((r) => r.id === id);
    dispatch({ type: "UPDATE_RAMS", id, updates: { status } });
    try {
      await updateRamsRecord(id, { status });
    } catch {
      if (prev) dispatch({ type: "UPDATE_RAMS", id, updates: { status: prev.status } });
      toast.error("Failed to update status");
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteRamsRecord(id);
      dispatch({ type: "REMOVE_RAMS", id });
      setSelected(null);
      toast.success(`${title} deleted`);
    } catch {
      toast.error("Failed to delete RAMS record");
    }
  }

  async function handleSign(ramsId: string) {
    if (!signName.trim()) return;
    setSigning(true);
    try {
      const result = await acknowledgeRams(ramsId, {
        name: signName.trim(),
        role: signRole || undefined,
      });
      dispatch({ type: "UPDATE_RAMS", id: ramsId, updates: toRamsRecord(result) });
      setSignName("");
      setSignRole("");
      toast.success("Briefing acknowledged");
    } catch {
      toast.error("Failed to record sign-off");
    } finally {
      setSigning(false);
    }
  }

  const activeCount = rams.filter((r) => r.status === "active").length;
  const needsReviewCount = rams.filter((r) => {
    if (r.status !== "active") return false;
    const days = daysUntil(r.review_date);
    return days !== null && days <= 14;
  }).length;
  const unbriefedCount = rams.filter((r) => r.status === "active" && !r.briefed_at).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
            RAMS &amp; Toolbox Talks
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Risk assessments, method statements and site briefing sign-off
          </p>
        </div>
        {canManage && (
          <Btn onClick={openNew}>
            <Plus className="w-4 h-4" strokeWidth={1.5} /> New RAMS
          </Btn>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard accent label="Active" value={activeCount.toString()} sub="Live on site" />
        <StatCard
          danger={needsReviewCount > 0}
          label="Needs Review"
          value={needsReviewCount.toString()}
          sub="Due within 14 days"
          actionLabel={needsReviewCount > 0 ? "View" : undefined}
          onAction={() => setStatusFilter("active")}
        />
        <StatCard
          danger={unbriefedCount > 0}
          label="Unbriefed"
          value={unbriefedCount.toString()}
          sub="Active, no sign-off yet"
        />
        <StatCard
          label="Draft"
          value={rams.filter((r) => r.status === "draft").length.toString()}
          sub="Not yet issued"
        />
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {STATUS_OPTIONS.map((opt) => {
          const count =
            opt.id === "all" ? rams.length : rams.filter((r) => r.status === opt.id).length;
          return (
            <button
              key={opt.id}
              onClick={() => setStatusFilter(opt.id)}
              className="px-4 py-2.5 text-sm transition-colors whitespace-nowrap flex items-center gap-1.5"
              style={
                statusFilter === opt.id
                  ? {
                      color: "var(--ink)",
                      fontWeight: 600,
                      borderBottom: "2px solid var(--accent)",
                      marginBottom: "-1px",
                    }
                  : { color: "var(--muted)" }
              }
            >
              {opt.label}
              <span
                className="inline-flex items-center justify-center px-1.5 text-[11px] font-bold"
                style={{
                  fontFamily: "var(--font-heading)",
                  backgroundColor:
                    statusFilter === opt.id ? "var(--accent-bg)" : "var(--surface-3)",
                  color: statusFilter === opt.id ? "var(--accent)" : "var(--muted-2)",
                  minWidth: "18px",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={selectedRams ? "xl:col-span-2" : "xl:col-span-3"}>
          <Panel title="RAMS Register" badge={filtered.length} noPad>
            {filtered.length === 0 ? (
              <EmptyState
                icon={ShieldAlert}
                title={rams.length === 0 ? "No RAMS records yet" : "No records match this filter"}
                description={
                  rams.length === 0
                    ? "Build a risk assessment and method statement for each high-risk activity, then record who's been briefed on it."
                    : "Try a different status filter."
                }
                primaryLabel={rams.length === 0 && canManage ? "Create your first RAMS" : undefined}
                onPrimary={rams.length === 0 && canManage ? openNew : undefined}
              />
            ) : (
              filtered.map((r, i) => {
                const review = reviewInfo(r);
                const needsAttention = r.status === "active" && (!!review || !r.briefed_at);
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelected(selected === r.id ? null : r.id)}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--surface-2)] group"
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      backgroundColor: selected === r.id ? "var(--surface-2)" : undefined,
                      borderLeft: `3px solid ${
                        review?.danger ? "var(--danger)" : needsAttention ? "var(--warning)" : "transparent"
                      }`,
                    }}
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "var(--surface-3)", border: "1px solid var(--border)" }}
                    >
                      <ShieldAlert
                        className="w-3.5 h-3.5"
                        strokeWidth={1.5}
                        style={{ color: "var(--muted-2)" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                          {r.title}
                        </span>
                        <Badge status={r.risk_level} />
                      </div>
                      <div className="text-xs flex items-center gap-2 truncate" style={{ color: "var(--muted)" }}>
                        <span>{r.activity}</span>
                        {r.job_title && (
                          <>
                            <span>&middot;</span>
                            <span>{r.job_title}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {review && (
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: review.danger ? "var(--danger)" : "var(--warning)" }}
                        >
                          {review.label}
                        </span>
                      )}
                      <Badge status={r.status} />
                      <ChevronRight
                        className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        strokeWidth={1.5}
                        style={{ color: "var(--muted)" }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </Panel>
        </div>

        {selectedRams && (
          <div>
            <Panel
              actions={
                <div className="flex items-center gap-1">
                  {canManage && (
                    <button
                      onClick={() => handleDelete(selectedRams.id, selectedRams.title)}
                      className="p-1 transition-colors hover:bg-red-50"
                      style={{ color: "var(--danger)" }}
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 transition-colors hover:bg-[var(--surface-3)]"
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
                    <Badge status={selectedRams.status} />
                    <Badge status={selectedRams.risk_level} />
                  </div>
                  <p
                    className="text-lg font-semibold"
                    style={{ color: "var(--ink)", fontFamily: "var(--font-heading)" }}
                  >
                    {selectedRams.title}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                    {selectedRams.activity}
                    {selectedRams.job_title ? ` · ${selectedRams.job_title}` : ""}
                  </p>
                </div>

                {canManage && (
                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: "var(--muted)" }}
                    >
                      Status
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(selectedRams.id, s)}
                          className="px-2.5 py-1.5 text-xs font-medium transition-colors capitalize"
                          style={
                            selectedRams.status === s
                              ? { backgroundColor: "var(--accent)", color: "#ffffff" }
                              : {
                                  backgroundColor: "transparent",
                                  color: "var(--ink-2)",
                                  border: "1px solid var(--border)",
                                }
                          }
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRams.hazards.length > 0 && (
                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: "var(--muted)" }}
                    >
                      Hazards &amp; Controls
                    </p>
                    <div className="space-y-2">
                      {selectedRams.hazards.map((h, i) => (
                        <div
                          key={i}
                          className="p-2.5 text-xs space-y-1"
                          style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                        >
                          <p className="font-semibold" style={{ color: "var(--ink)" }}>
                            {h.hazard}
                          </p>
                          {h.who_at_risk && (
                            <p style={{ color: "var(--muted)" }}>Who's at risk: {h.who_at_risk}</p>
                          )}
                          {h.controls && (
                            <p style={{ color: "var(--muted)" }}>Controls: {h.controls}</p>
                          )}
                          {(h.risk_before || h.risk_after) && (
                            <p style={{ color: "var(--muted)" }}>
                              Risk: {h.risk_before ?? "—"} → {h.risk_after ?? "—"}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRams.ppe.length > 0 && (
                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: "var(--muted)" }}
                    >
                      PPE Required
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRams.ppe.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-1 text-xs"
                          style={{ backgroundColor: "var(--surface-3)", color: "var(--ink-2)" }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                      Review Date
                    </span>
                    <span className="text-sm font-mono tnum" style={{ color: "var(--ink)" }}>
                      {selectedRams.review_date ? formatDate(selectedRams.review_date) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                      First Briefed
                    </span>
                    <span className="text-sm" style={{ color: "var(--ink)" }}>
                      {selectedRams.briefed_at
                        ? `${formatDate(selectedRams.briefed_at)} by ${selectedRams.briefed_by ?? "—"}`
                        : "Not yet briefed"}
                    </span>
                  </div>
                </div>

                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: "var(--muted)" }}
                  >
                    Toolbox Talk Sign-Off ({selectedRams.attendees.length})
                  </p>
                  <div className="space-y-1.5 mb-3">
                    {selectedRams.attendees.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--muted-2)" }}>
                        No one has signed in to this briefing yet.
                      </p>
                    ) : (
                      selectedRams.attendees.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs px-2.5 py-1.5"
                          style={{ backgroundColor: "var(--surface-2)" }}
                        >
                          <span style={{ color: "var(--ink)" }}>
                            {a.name}
                            {a.role ? ` · ${a.role}` : ""}
                          </span>
                          {a.acknowledged ? (
                            <span
                              className="flex items-center gap-1 font-semibold"
                              style={{ color: "var(--success)" }}
                            >
                              <Check className="w-3 h-3" strokeWidth={2} />
                              {a.acknowledged_at ? formatDate(a.acknowledged_at) : "Signed"}
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted-2)" }}>Not signed</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={signName}
                      onChange={(e) => setSignName(e.target.value)}
                      placeholder="Your name"
                      className="flex-1"
                    />
                    <Input
                      value={signRole}
                      onChange={(e) => setSignRole(e.target.value)}
                      placeholder="Role (optional)"
                      className="flex-1"
                    />
                    <Btn
                      onClick={() => handleSign(selectedRams.id)}
                      disabled={signing || !signName.trim()}
                    >
                      <UserCheck className="w-4 h-4" strokeWidth={1.5} />
                    </Btn>
                  </div>
                </div>

                {selectedRams.notes && (
                  <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: "var(--muted)" }}
                    >
                      Notes
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                      {selectedRams.notes}
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New RAMS Record">
        <div className="space-y-4">
          <Field label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Excavation near live services — Plot 4"
            />
            {errors.title && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {errors.title}
              </p>
            )}
          </Field>
          <Field label="Activity" required>
            <Input
              value={form.activity}
              onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))}
              placeholder="e.g. Trial holes and excavation to 1.8m"
            />
            {errors.activity && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {errors.activity}
              </p>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Risk Level">
              <Select
                value={form.riskLevel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, riskLevel: e.target.value as RamsRiskLevel }))
                }
              >
                {RISK_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l[0].toUpperCase() + l.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Related Job">
              <Select
                value={form.jobId}
                onChange={(e) => setForm((f) => ({ ...f, jobId: e.target.value }))}
              >
                <option value="">None</option>
                {jobs
                  .filter((j) => j.status === "active" || j.status === "quoted")
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.job_number} — {j.title}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Review Date">
              <Input
                type="date"
                value={form.reviewDate}
                onChange={(e) => setForm((f) => ({ ...f, reviewDate: e.target.value }))}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div
                className="text-xs font-mono uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                Hazards &amp; Controls
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, hazards: [...f.hazards, { ...emptyHazard }] }))
                }
                className="text-xs font-semibold"
                style={{ color: "var(--accent)" }}
              >
                + Add hazard
              </button>
            </div>
            <div className="space-y-3">
              {form.hazards.map((h, idx) => (
                <div
                  key={idx}
                  className="p-3 space-y-2"
                  style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={h.hazard}
                      onChange={(e) => updateHazard(idx, "hazard", e.target.value)}
                      placeholder="Hazard (e.g. Underground services strike)"
                      className="flex-1"
                    />
                    {form.hazards.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            hazards: f.hazards.filter((_, i) => i !== idx),
                          }))
                        }
                        style={{ color: "var(--danger)" }}
                      >
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={h.whoAtRisk}
                      onChange={(e) => updateHazard(idx, "whoAtRisk", e.target.value)}
                      placeholder="Who's at risk"
                    />
                    <Input
                      value={h.controls}
                      onChange={(e) => updateHazard(idx, "controls", e.target.value)}
                      placeholder="Control measures"
                    />
                    <Input
                      value={h.riskBefore}
                      onChange={(e) => updateHazard(idx, "riskBefore", e.target.value)}
                      placeholder="Risk before (e.g. High)"
                    />
                    <Input
                      value={h.riskAfter}
                      onChange={(e) => updateHazard(idx, "riskAfter", e.target.value)}
                      placeholder="Risk after (e.g. Low)"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="PPE Required" hint="Comma-separated">
            <Input
              value={form.ppe}
              onChange={(e) => setForm((f) => ({ ...f, ppe: e.target.value }))}
              placeholder="Hard hat, Hi-vis, Safety boots, Gloves"
            />
          </Field>

          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any relevant notes..."
              rows={2}
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <Btn className="flex-1 justify-center" onClick={handleSubmit} disabled={saving}>
              {saving ? "Creating…" : "Create RAMS"}
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
