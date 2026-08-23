import { useState } from "react";
import {
  Plus,
  Truck,
  AlertTriangle,
  Wrench,
  X,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { Badge } from "../components/ui/Badge";
import { Btn } from "../components/ui/Btn";
import { Modal, Field, Input, Select, Textarea } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { cn, formatDate, formatCurrency, daysUntil } from "../lib/utils";
import { useApp } from "../store/AppContext";
import {
  createPlantItem,
  updatePlantItem,
  deletePlantItem,
} from "@workspace/api-client-react";
import { toPlant } from "../lib/apiTransforms";
import { toast } from "sonner";
import type { PlantStatus } from "../types";

const PLANT_STATUSES: PlantStatus[] = [
  "available",
  "on_site",
  "maintenance",
  "hired_in",
  "disposed",
];

const emptyForm = {
  name: "",
  make: "",
  model: "",
  year: "",
  registration: "",
  category: "",
  owned: true,
  daily_rate: "",
  service_due: "",
  mot_due: "",
  thorough_exam_due: "",
  notes: "",
};

export function PlantPage() {
  const { state, dispatch } = useApp();
  const { plant } = state;

  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filtered = plant.filter(
    (p) => statusFilter === "all" || p.status === statusFilter,
  );
  const selectedPlant = selected ? plant.find((p) => p.id === selected) : null;

  const STATUS_OPTIONS = [
    { id: "all", label: "All" },
    { id: "available", label: "Available" },
    { id: "on_site", label: "On Site" },
    { id: "maintenance", label: "Workshop" },
    { id: "hired_in", label: "Hired In" },
  ];

  function getPlantAlerts(p: (typeof plant)[0]) {
    const warnings: string[] = [];
    const serviceDays = daysUntil(p.service_due);
    if (serviceDays !== null && serviceDays <= 14)
      warnings.push(
        `Service ${serviceDays <= 0 ? "OVERDUE" : `in ${serviceDays}d`}`,
      );
    const teDays = daysUntil(p.thorough_exam_due);
    if (teDays !== null && teDays <= 30)
      warnings.push(`LOLER Exam ${teDays <= 0 ? "EXPIRED" : `in ${teDays}d`}`);
    return warnings;
  }

  function openNew() {
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
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
      const result = await createPlantItem({
        name: form.name.trim(),
        make: form.make || undefined,
        model: form.model || undefined,
        year: form.year ? parseInt(form.year) : undefined,
        registration: form.registration || undefined,
        category: form.category || "other",
        owned: form.owned,
        status: "available",
        dailyRate: form.daily_rate ? parseFloat(form.daily_rate) : undefined,
        serviceDue: form.service_due || undefined,
        motDue: form.mot_due || undefined,
        thoroughExamDue: form.thorough_exam_due || undefined,
        notes: form.notes || undefined,
      } as any);
      dispatch({ type: "ADD_PLANT", plant: toPlant(result) });
      setShowModal(false);
      toast.success(`${result.name} added to fleet`);
    } catch {
      toast.error("Failed to add plant item");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: PlantStatus) {
    const prev = plant.find((p) => p.id === id);
    dispatch({ type: "UPDATE_PLANT", id, updates: { status } });
    try {
      await updatePlantItem(id, { status });
    } catch {
      if (prev)
        dispatch({
          type: "UPDATE_PLANT",
          id,
          updates: { status: prev.status },
        });
      toast.error("Failed to update status");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await deletePlantItem(id);
      dispatch({ type: "REMOVE_PLANT", id });
      setSelected(null);
      toast.success(`${name} removed from fleet`);
    } catch {
      toast.error("Failed to delete plant item");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#181410" }}>
            Plant & Machinery
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#7a7469" }}>
            Fleet tracking, service & LOLER compliance
          </p>
        </div>
        <Btn onClick={openNew}>
          <Plus className="w-4 h-4" /> Add Plant
        </Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          accent
          label="On Site"
          value={plant.filter((p) => p.status === "on_site").length.toString()}
          sub="Currently deployed"
        />
        <StatCard
          label="Available"
          value={plant
            .filter((p) => p.status === "available")
            .length.toString()}
          sub="Ready for site"
        />
        <StatCard
          danger={plant.filter((p) => p.status === "maintenance").length > 0}
          label="Workshop"
          value={plant
            .filter((p) => p.status === "maintenance")
            .length.toString()}
          sub="Under maintenance"
        />
        <StatCard
          label="Owned"
          value={plant.filter((p) => p.owned).length.toString()}
          sub="Company assets"
        />
      </div>

      <div
        className="flex items-center gap-1"
        style={{ borderBottom: "1px solid #d9d4ce" }}
      >
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setStatusFilter(opt.id)}
            className="px-4 py-2.5 text-sm transition-colors"
            style={
              statusFilter === opt.id
                ? {
                    color: "#181410",
                    fontWeight: 500,
                    borderBottom: "2px solid #1b5e78",
                    marginBottom: "-1px",
                  }
                : { color: "#7a7469" }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={selectedPlant ? "xl:col-span-2" : "xl:col-span-3"}>
          <Panel title="Plant Register" badge={filtered.length} noPad>
            {filtered.length === 0 ? (
              <p
                className="text-center py-12 text-sm"
                style={{ color: "#c0bab4" }}
              >
                No plant items found
              </p>
            ) : (
              filtered.map((p, i) => {
                const alerts = getPlantAlerts(p);
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelected(selected === p.id ? null : p.id)}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[#eeeae4] group"
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? "1px solid #d9d4ce" : "none",
                      backgroundColor:
                        selected === p.id ? "#eeeae4" : undefined,
                      borderLeft:
                        selected === p.id
                          ? "2px solid #1b5e78"
                          : "2px solid transparent",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: "#e8e4dd",
                        border: "1px solid #d9d4ce",
                      }}
                    >
                      {p.status === "maintenance" ? (
                        <Wrench
                          className="w-3.5 h-3.5"
                          style={{ color: "#e07b39" }}
                        />
                      ) : (
                        <Truck
                          className="w-3.5 h-3.5"
                          style={{ color: "#8a8377" }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-sm font-semibold truncate"
                          style={{ color: "#181410" }}
                        >
                          {p.name}
                        </span>
                        {alerts.length > 0 && (
                          <AlertTriangle
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: "#e07b39" }}
                          />
                        )}
                        {!p.owned && (
                          <span
                            className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: "#e8e4dd",
                              color: "#4a4540",
                            }}
                          >
                            Hired In
                          </span>
                        )}
                      </div>
                      <div
                        className="text-xs flex items-center gap-2 truncate"
                        style={{ color: "#7a7469" }}
                      >
                        <span className="font-mono tnum">
                          {p.registration ?? "No Reg"}
                        </span>
                        <span>&middot;</span>
                        <span>
                          {p.make} {p.model}
                        </span>
                        {p.year && (
                          <>
                            <span>&middot;</span>
                            <span className="font-mono tnum">{p.year}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <Badge status={p.status} />
                    </div>
                    {p.daily_rate && (
                      <div className="w-24 hidden lg:block flex-shrink-0 text-right">
                        <div
                          className="text-[10px] font-bold uppercase tracking-widest mb-1"
                          style={{ color: "#7a7469" }}
                        >
                          Day Rate
                        </div>
                        <div
                          className="text-sm font-medium font-mono tnum"
                          style={{ color: "#181410" }}
                        >
                          {formatCurrency(p.daily_rate)}
                        </div>
                      </div>
                    )}
                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "#7a7469" }}
                    />
                  </div>
                );
              })
            )}
          </Panel>
        </div>

        {selectedPlant && (
          <div>
            <Panel
              actions={
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      handleDelete(selectedPlant.id, selectedPlant.name)
                    }
                    className="p-1 rounded-md transition-colors hover:bg-red-50"
                    style={{ color: "#c13a2a" }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded-md transition-colors hover:bg-[#e8e4dd]"
                    style={{ color: "#7a7469" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              }
            >
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge status={selectedPlant.status} />
                    {!selectedPlant.owned && (
                      <span
                        className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ backgroundColor: "#e8e4dd", color: "#4a4540" }}
                      >
                        Hired In
                      </span>
                    )}
                  </div>
                  <p
                    className="text-lg font-semibold"
                    style={{
                      color: "#181410",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {selectedPlant.name}
                  </p>
                </div>

                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: "#7a7469" }}
                  >
                    Status
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLANT_STATUSES.filter((s) => s !== "disposed").map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedPlant.id, s)}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors capitalize"
                        style={
                          selectedPlant.status === s
                            ? { backgroundColor: "#1b5e78", color: "#ffffff" }
                            : {
                                backgroundColor: "transparent",
                                color: "#4a4540",
                                border: "1px solid #d9d4ce",
                              }
                        }
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="space-y-0 pt-2"
                  style={{ borderTop: "1px solid #d9d4ce" }}
                >
                  {[
                    {
                      label: "Make / Model",
                      value:
                        `${selectedPlant.make ?? "—"} ${selectedPlant.model ?? ""}`.trim(),
                    },
                    {
                      label: "Year",
                      value: selectedPlant.year?.toString() ?? "—",
                      mono: true,
                    },
                    {
                      label: "Registration",
                      value: selectedPlant.registration ?? "—",
                      mono: true,
                    },
                    { label: "Category", value: selectedPlant.category },
                    {
                      label: "Day Rate",
                      value: selectedPlant.daily_rate
                        ? formatCurrency(selectedPlant.daily_rate)
                        : "—",
                      mono: true,
                    },
                    {
                      label: "Current Job",
                      value: selectedPlant.current_job?.title ?? "—",
                    },
                  ].map(({ label, value, mono }) => (
                    <div
                      key={label}
                      className="flex justify-between items-baseline gap-3 py-2.5"
                      style={{ borderBottom: "1px solid #ece8e3" }}
                    >
                      <span
                        className="text-xs font-medium flex-shrink-0"
                        style={{ color: "#7a7469" }}
                      >
                        {label}
                      </span>
                      <span
                        className={cn(
                          "text-sm text-right",
                          mono && "font-mono tnum",
                        )}
                        style={{ color: "#181410" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: "#7a7469" }}
                  >
                    Compliance
                  </p>
                  <div className="space-y-0">
                    {[
                      {
                        label: "Service Due",
                        value: selectedPlant.service_due,
                      },
                      { label: "MOT Due", value: selectedPlant.mot_due },
                      {
                        label: "LOLER Exam",
                        value: selectedPlant.thorough_exam_due,
                      },
                    ].map(({ label, value }) => {
                      const days = daysUntil(value);
                      const isOverdue = days !== null && days <= 0;
                      const isDue = days !== null && days > 0 && days <= 30;
                      return (
                        <div
                          key={label}
                          className="flex justify-between items-center py-2.5"
                          style={{ borderBottom: "1px solid #ece8e3" }}
                        >
                          <span
                            className="text-xs font-medium"
                            style={{ color: "#7a7469" }}
                          >
                            {label}
                          </span>
                          <span
                            className="text-sm font-mono tnum"
                            style={{
                              color: isOverdue
                                ? "#c13a2a"
                                : isDue
                                  ? "#e07b39"
                                  : value
                                    ? "#2a6e45"
                                    : "#8a8377",
                            }}
                          >
                            {value ? formatDate(value) : "N/A"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {getPlantAlerts(selectedPlant).length > 0 && (
                  <div
                    className="space-y-1.5 p-3 rounded-lg"
                    style={{
                      backgroundColor: "rgba(193,58,42,0.05)",
                      border: "1px solid rgba(193,58,42,0.1)",
                    }}
                  >
                    {getPlantAlerts(selectedPlant).map((w) => (
                      <div
                        key={w}
                        className="flex items-center gap-2 text-xs font-medium"
                        style={{ color: "#c13a2a" }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                {selectedPlant.notes && (
                  <div className="pt-2">
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: "#7a7469" }}
                    >
                      Notes
                    </p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#4a4540" }}
                    >
                      {selectedPlant.notes}
                    </p>
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
        title="Add Plant Item"
      >
        <div className="space-y-4">
          <Field label="Name / Description" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 13T Tracked Excavator"
            />
            {errors.name && (
              <p className="mt-1 text-xs" style={{ color: "#c13a2a" }}>
                {errors.name}
              </p>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Make">
              <Input
                value={form.make}
                onChange={(e) =>
                  setForm((f) => ({ ...f, make: e.target.value }))
                }
                placeholder="e.g. Caterpillar"
              />
            </Field>
            <Field label="Model">
              <Input
                value={form.model}
                onChange={(e) =>
                  setForm((f) => ({ ...f, model: e.target.value }))
                }
                placeholder="e.g. 313"
              />
            </Field>
            <Field label="Year">
              <Input
                type="number"
                value={form.year}
                onChange={(e) =>
                  setForm((f) => ({ ...f, year: e.target.value }))
                }
                placeholder="2021"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration">
              <Input
                value={form.registration}
                onChange={(e) =>
                  setForm((f) => ({ ...f, registration: e.target.value }))
                }
                placeholder="e.g. BM21 XYZ"
              />
            </Field>
            <Field label="Category">
              <Input
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="e.g. Excavator"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily Rate (£)">
              <Input
                type="number"
                value={form.daily_rate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, daily_rate: e.target.value }))
                }
                placeholder="0.00"
              />
            </Field>
            <Field label="Ownership">
              <Select
                value={form.owned ? "owned" : "hired"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, owned: e.target.value === "owned" }))
                }
              >
                <option value="owned">Owned</option>
                <option value="hired">Hired In</option>
              </Select>
            </Field>
          </div>
          <div>
            <div
              className="text-xs font-mono uppercase tracking-wider mb-3"
              style={{ color: "#7a7469" }}
            >
              Compliance Dates
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Next Service Due">
                <Input
                  type="date"
                  value={form.service_due}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, service_due: e.target.value }))
                  }
                />
              </Field>
              <Field label="MOT Due">
                <Input
                  type="date"
                  value={form.mot_due}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mot_due: e.target.value }))
                  }
                />
              </Field>
              <Field label="LOLER Exam Due" hint="LOLER Thorough Examination">
                <Input
                  type="date"
                  value={form.thorough_exam_due}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      thorough_exam_due: e.target.value,
                    }))
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
              rows={2}
            />
          </Field>
          <div className="flex gap-3 pt-2">
            <Btn
              className="flex-1 justify-center"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Adding…" : "Add to Fleet"}
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
