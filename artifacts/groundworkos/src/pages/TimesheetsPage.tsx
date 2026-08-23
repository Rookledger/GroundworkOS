import { useState, useMemo } from "react";
import { Plus, Clock, Trash2, X, ChevronRight, Download } from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Btn } from "../components/ui/Btn";
import { Modal, Field, Input, Select, Textarea } from "../components/ui/Modal";
import { cn, formatCurrency, formatDate } from "../lib/utils";
import { useApp } from "../store/AppContext";
import { toTimesheet } from "../lib/apiTransforms";
import { toast } from "sonner";
import type { Timesheet } from "../types";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiPost(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiDelete(path: string) {
  const r = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
}

const emptyForm = {
  worker_name: "",
  job_id: "",
  work_date: new Date().toISOString().split("T")[0],
  hours_worked: "8",
  day_rate: "",
  description: "",
};

function weekRange() {
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { mon, sun };
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
}

function inRange(dateStr: string, from: Date, to: Date) {
  const d = new Date(dateStr);
  return d >= from && d <= to;
}

const TABS = [
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

export function TimesheetsPage() {
  const { state, dispatch } = useApp();
  const { timesheets, jobs } = state;

  const [tab, setTab] = useState<"week" | "month" | "all">("week");
  const [jobFilter, setJobFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { mon, sun } = weekRange();
  const { start: mStart, end: mEnd } = monthRange();

  const filtered = useMemo(() => {
    let list = [...timesheets];
    if (tab === "week")
      list = list.filter((t) => inRange(t.work_date, mon, sun));
    if (tab === "month")
      list = list.filter((t) => inRange(t.work_date, mStart, mEnd));
    if (jobFilter) list = list.filter((t) => t.job_id === jobFilter);
    return list.sort(
      (a, b) =>
        b.work_date.localeCompare(a.work_date) ||
        b.created_at.localeCompare(a.created_at),
    );
  }, [timesheets, tab, jobFilter, mon, sun, mStart, mEnd]);

  const weekEntries = timesheets.filter((t) => inRange(t.work_date, mon, sun));
  const weekHours = weekEntries.reduce((s, t) => s + t.hours_worked, 0);
  const weekCost = weekEntries.reduce((s, t) => s + (t.cost ?? 0), 0);
  const monthEntries = timesheets.filter((t) =>
    inRange(t.work_date, mStart, mEnd),
  );
  const monthCost = monthEntries.reduce((s, t) => s + (t.cost ?? 0), 0);
  const uniqueWorkers = new Set(timesheets.map((t) => t.worker_name)).size;

  const grouped = useMemo(() => {
    const map = new Map<string, Timesheet[]>();
    for (const t of filtered) {
      const key = t.work_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const selectedEntry = selected
    ? timesheets.find((t) => t.id === selected)
    : null;

  function openNew() {
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.worker_name.trim()) e.worker_name = "Worker name is required";
    if (!form.work_date) e.work_date = "Date is required";
    const h = parseFloat(form.hours_worked);
    if (!form.hours_worked || isNaN(h) || h <= 0 || h > 24)
      e.hours_worked = "Enter valid hours (0–24)";
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
      const hoursWorked = parseFloat(form.hours_worked);
      const dayRate = form.day_rate ? parseFloat(form.day_rate) : null;
      const result = await apiPost("/api/timesheets", {
        workerName: form.worker_name.trim(),
        jobId: form.job_id || null,
        workDate: form.work_date,
        hoursWorked,
        dayRate,
        description: form.description || null,
      });
      dispatch({ type: "ADD_TIMESHEET", timesheet: toTimesheet(result) });
      setShowModal(false);
      toast.success("Timesheet entry added");
    } catch {
      toast.error("Failed to add entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this timesheet entry?")) return;
    try {
      await apiDelete(`/api/timesheets/${id}`);
      dispatch({ type: "REMOVE_TIMESHEET", id });
      if (selected === id) setSelected(null);
      toast.success("Entry deleted");
    } catch {
      toast.error("Failed to delete entry");
    }
  }

  function handleExport() {
    const headers = [
      "Date",
      "Worker",
      "Job",
      "Hours",
      "Day Rate",
      "Cost",
      "Description",
    ];
    const rows = filtered.map((t) => [
      t.work_date,
      t.worker_name,
      t.job_title ? `${t.job_number} – ${t.job_title}` : "",
      t.hours_worked,
      t.day_rate ?? "",
      t.cost ?? "",
      t.description ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `timesheets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{
              color: "#181410",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Timesheets
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#7a7469" }}>
            Labour hours and day rates across all sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Btn>
          <Btn onClick={openNew}>
            <Plus className="w-4 h-4" /> Log Hours
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          accent
          label="Hours This Week"
          value={`${weekHours.toFixed(1)}h`}
          sub={`${weekEntries.length} entries`}
        />
        <StatCard
          label="Labour Cost — Week"
          value={formatCurrency(weekCost)}
          sub="based on day rates"
        />
        <StatCard
          label="Labour Cost — Month"
          value={formatCurrency(monthCost)}
          sub={`${monthEntries.length} entries`}
        />
        <StatCard
          label="Active Workers"
          value={uniqueWorkers}
          sub="on the books"
        />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div
          className="flex items-center gap-1"
          style={{ borderBottom: "1px solid #d9d4ce" }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className="px-4 py-2 text-sm transition-colors whitespace-nowrap"
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
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-md focus:outline-none"
            style={{
              backgroundColor: "#fafaf8",
              border: "1px solid #d9d4ce",
              color: "#181410",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.job_number} – {j.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-6 items-start",
          selectedEntry ? "xl:grid-cols-3" : "xl:grid-cols-1",
        )}
      >
        <div className={selectedEntry ? "xl:col-span-2" : ""}>
          {filtered.length === 0 ? (
            <Panel title="No entries">
              <div className="text-center py-16">
                <Clock
                  className="w-10 h-10 mx-auto mb-3 opacity-20"
                  style={{ color: "#1b5e78" }}
                />
                <p className="text-sm font-medium" style={{ color: "#4a4540" }}>
                  No timesheet entries found
                </p>
                <p className="text-sm mt-1 mb-5" style={{ color: "#a8a099" }}>
                  {tab === "week"
                    ? "No hours logged this week"
                    : tab === "month"
                      ? "No hours logged this month"
                      : "No entries yet"}
                </p>
                <Btn size="sm" onClick={openNew}>
                  <Plus className="w-3.5 h-3.5" /> Log Hours
                </Btn>
              </div>
            </Panel>
          ) : (
            <div className="space-y-4">
              {grouped.map(([date, entries]) => {
                const dayHours = entries.reduce(
                  (s, t) => s + t.hours_worked,
                  0,
                );
                const dayCost = entries.reduce((s, t) => s + (t.cost ?? 0), 0);
                return (
                  <Panel
                    key={date}
                    title={formatDate(date)}
                    badge={`${dayHours.toFixed(1)}h${dayCost > 0 ? ` · ${formatCurrency(dayCost)}` : ""}`}
                    noPad
                  >
                    {entries.map((entry, i) => (
                      <div
                        key={entry.id}
                        onClick={() =>
                          setSelected(selected === entry.id ? null : entry.id)
                        }
                        className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 sm:py-3.5 cursor-pointer transition-colors hover:bg-[#eeeae4] group min-h-[64px]"
                        style={{
                          borderBottom:
                            i < entries.length - 1
                              ? "1px solid #ece8e3"
                              : "none",
                          backgroundColor:
                            selected === entry.id ? "#eeeae4" : undefined,
                          borderLeft:
                            selected === entry.id
                              ? "3px solid #1b5e78"
                              : "3px solid transparent",
                        }}
                      >
                        <div
                          className="w-10 h-10 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                          style={{
                            backgroundColor: "#e8f3f7",
                            color: "#1b5e78",
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}
                        >
                          {entry.worker_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="text-sm font-semibold"
                              style={{ color: "#181410" }}
                            >
                              {entry.worker_name}
                            </span>
                            {entry.job_title && (
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 hidden sm:inline"
                                style={{
                                  backgroundColor: "#e8e4dd",
                                  color: "#4a4540",
                                }}
                              >
                                {entry.job_number}
                              </span>
                            )}
                          </div>
                          {entry.description && (
                            <p
                              className="text-xs truncate"
                              style={{ color: "#7a7469" }}
                            >
                              {entry.description}
                            </p>
                          )}
                          {entry.job_title && !entry.description && (
                            <p
                              className="text-xs truncate"
                              style={{ color: "#7a7469" }}
                            >
                              {entry.job_title}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div
                            className="text-sm font-semibold font-mono"
                            style={{ color: "#181410" }}
                          >
                            {entry.hours_worked % 1 === 0
                              ? entry.hours_worked
                              : entry.hours_worked.toFixed(1)}
                            h
                          </div>
                          {entry.cost != null && entry.cost > 0 && (
                            <div
                              className="text-xs font-mono"
                              style={{ color: "#7a7469" }}
                            >
                              {formatCurrency(entry.cost)}
                            </div>
                          )}
                        </div>
                        <ChevronRight
                          className="w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"
                          style={{ color: "#1b5e78" }}
                        />
                      </div>
                    ))}
                  </Panel>
                );
              })}
            </div>
          )}
        </div>

        {selectedEntry && (
          <div className="xl:col-span-1">
            <Panel
              title="Entry Details"
              actions={
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 rounded transition-colors hover:bg-[#eeeae4]"
                  style={{ color: "#7a7469" }}
                >
                  <X className="w-4 h-4" />
                </button>
              }
            >
              <div className="space-y-4">
                <div
                  className="flex items-center gap-3 pb-4"
                  style={{ borderBottom: "1px solid #ece8e3" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      backgroundColor: "#e8f3f7",
                      color: "#1b5e78",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {selectedEntry.worker_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div
                      className="font-semibold"
                      style={{
                        color: "#181410",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {selectedEntry.worker_name}
                    </div>
                    <div className="text-xs" style={{ color: "#7a7469" }}>
                      {formatDate(selectedEntry.work_date)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-lg p-3 text-center"
                    style={{ backgroundColor: "#f0ede8" }}
                  >
                    <div
                      className="text-2xl font-bold font-mono"
                      style={{
                        color: "#1b5e78",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {selectedEntry.hours_worked % 1 === 0
                        ? selectedEntry.hours_worked
                        : selectedEntry.hours_worked.toFixed(1)}
                    </div>
                    <div
                      className="text-[11px] font-bold uppercase tracking-widest mt-0.5"
                      style={{ color: "#7a7469" }}
                    >
                      Hours
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-3 text-center"
                    style={{ backgroundColor: "#f0ede8" }}
                  >
                    <div
                      className="text-2xl font-bold font-mono"
                      style={{
                        color: selectedEntry.cost ? "#181410" : "#c0bab4",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {selectedEntry.cost != null
                        ? formatCurrency(selectedEntry.cost)
                        : "—"}
                    </div>
                    <div
                      className="text-[11px] font-bold uppercase tracking-widest mt-0.5"
                      style={{ color: "#7a7469" }}
                    >
                      Cost
                    </div>
                  </div>
                </div>

                {selectedEntry.day_rate != null && (
                  <div
                    className="flex items-center justify-between text-sm"
                    style={{
                      borderBottom: "1px solid #ece8e3",
                      paddingBottom: "12px",
                    }}
                  >
                    <span style={{ color: "#7a7469" }}>Day rate</span>
                    <span
                      className="font-mono font-medium"
                      style={{ color: "#181410" }}
                    >
                      {formatCurrency(selectedEntry.day_rate)}/day
                    </span>
                  </div>
                )}

                {selectedEntry.job_title && (
                  <div
                    className="flex items-center justify-between text-sm"
                    style={{
                      borderBottom: "1px solid #ece8e3",
                      paddingBottom: "12px",
                    }}
                  >
                    <span style={{ color: "#7a7469" }}>Job</span>
                    <span
                      className="font-medium text-right"
                      style={{ color: "#181410" }}
                    >
                      <span
                        className="font-mono text-xs mr-1"
                        style={{ color: "#1b5e78" }}
                      >
                        {selectedEntry.job_number}
                      </span>
                      {selectedEntry.job_title}
                    </span>
                  </div>
                )}

                {selectedEntry.description && (
                  <div
                    className="text-sm"
                    style={{
                      borderBottom: "1px solid #ece8e3",
                      paddingBottom: "12px",
                    }}
                  >
                    <div
                      className="mb-1 font-medium text-xs uppercase tracking-widest"
                      style={{ color: "#7a7469" }}
                    >
                      Site Notes
                    </div>
                    <p style={{ color: "#4a4540", lineHeight: 1.6 }}>
                      {selectedEntry.description}
                    </p>
                  </div>
                )}

                <div className="text-xs" style={{ color: "#a8a099" }}>
                  Logged{" "}
                  {new Date(selectedEntry.created_at).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </div>

                <button
                  onClick={() => handleDelete(selectedEntry.id)}
                  className="flex items-center gap-2 text-sm mt-2 px-3 py-2 rounded-md w-full justify-center transition-colors hover:bg-red-50"
                  style={{ color: "#c13a2a", border: "1px solid #fca5a5" }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Entry
                </button>
              </div>
            </Panel>
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          open={showModal}
          title="Log Hours"
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            <Field label="Worker Name *" error={errors.worker_name}>
              <Input
                value={form.worker_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, worker_name: e.target.value }))
                }
                placeholder="e.g. John Smith"
                error={!!errors.worker_name}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date *" error={errors.work_date}>
                <Input
                  type="date"
                  value={form.work_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, work_date: e.target.value }))
                  }
                  error={!!errors.work_date}
                />
              </Field>
              <Field label="Hours *" error={errors.hours_worked}>
                <Input
                  type="number"
                  value={form.hours_worked}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hours_worked: e.target.value }))
                  }
                  placeholder="8"
                  min="0.5"
                  max="24"
                  step="0.5"
                  error={!!errors.hours_worked}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Day Rate (£)">
                <Input
                  type="number"
                  value={form.day_rate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, day_rate: e.target.value }))
                  }
                  placeholder="e.g. 280"
                  min="0"
                  step="5"
                />
              </Field>
              <Field label="Job (optional)">
                <Select
                  value={form.job_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, job_id: e.target.value }))
                  }
                >
                  <option value="">No job linked</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.job_number} – {j.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {form.day_rate &&
              form.hours_worked &&
              !isNaN(parseFloat(form.day_rate)) &&
              !isNaN(parseFloat(form.hours_worked)) && (
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-md text-sm"
                  style={{ backgroundColor: "#e8f3f7" }}
                >
                  <span style={{ color: "#1b5e78" }}>Calculated cost</span>
                  <span
                    className="font-semibold font-mono"
                    style={{ color: "#1b5e78" }}
                  >
                    {formatCurrency(
                      Math.round(
                        (parseFloat(form.hours_worked) / 8) *
                          parseFloat(form.day_rate) *
                          100,
                      ) / 100,
                    )}
                  </span>
                </div>
              )}

            <Field label="Site Notes / Description">
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="What work was carried out..."
                rows={3}
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <Btn
                variant="outline"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Btn>
              <Btn className="flex-1" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving…" : "Log Entry"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
