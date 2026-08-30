import { useState, useRef } from "react";
import {
  Plus,
  Search,
  Filter,
  Download,
  X,
  ChevronRight,
  MapPin,
  Trash2,
  HardHat,
} from "lucide-react";
import { useLocation } from "wouter";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";
import { Btn } from "../components/ui/Btn";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal, Field, Input, Select, Textarea } from "../components/ui/Modal";
import { cn, formatCurrency, formatDate } from "../lib/utils";
import { useApp } from "../store/AppContext";
import { createJob, updateJob, deleteJob } from "@workspace/api-client-react";
import { toJob } from "../lib/apiTransforms";
import { toast } from "sonner";
import type { JobType, JobStatus } from "../types";

const TABS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "enquiry", label: "Enquiry" },
  { id: "quoted", label: "Quoted" },
  { id: "active", label: "Active" },
  { id: "complete", label: "Complete" },
];

const JOB_TYPES: JobType[] = [
  "drainage",
  "foundations",
  "excavation",
  "kerbing",
  "sewers",
  "reinstatement",
  "piling",
  "subbase",
  "utilities",
  "groundworks",
];
const JOB_STATUSES: JobStatus[] = [
  "enquiry",
  "quoted",
  "active",
  "on_hold",
  "complete",
  "cancelled",
];

const emptyForm = {
  title: "",
  client_id: "",
  type: "" as JobType | "",
  site_address: "",
  value: "",
  start_date: "",
  end_date: "",
  foreman: "",
  crew_count: "",
  nrswa_required: false,
  permit_number: "",
  description: "",
  status: "enquiry" as JobStatus,
};

export function JobsPage() {
  const { state, dispatch } = useApp();
  const { jobs, clients } = state;
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [filterTypes, setFilterTypes] = useState<JobType[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = jobs.filter((j) => {
    if (activeTab !== "all" && j.status !== activeTab) return false;
    if (filterTypes.length > 0 && !filterTypes.includes(j.type as JobType))
      return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        j.title.toLowerCase().includes(q) ||
        j.job_number.toLowerCase().includes(q) ||
        (j.client?.company_name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(job: (typeof jobs)[number]) {
    setEditingId(job.id);
    setForm({
      title: job.title,
      client_id: job.client_id ?? "",
      type: (job.type as JobType) ?? "",
      site_address: job.site_address ?? "",
      value: job.value ? String(job.value) : "",
      start_date: job.start_date ?? "",
      end_date: job.end_date ?? "",
      foreman: job.foreman ?? "",
      crew_count: job.crew_count ? String(job.crew_count) : "",
      nrswa_required: job.nrswa_required ?? false,
      permit_number: job.permit_number ?? "",
      description: job.description ?? "",
      status: job.status,
    });
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
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
      if (editingId) {
        const result = await updateJob(editingId, {
          title: form.title.trim(),
          clientId: form.client_id || undefined,
          type: (form.type as JobType) || undefined,
          siteAddress: form.site_address || undefined,
          value: form.value ? parseFloat(form.value) : undefined,
          startDate: form.start_date || undefined,
          endDate: form.end_date || undefined,
          status: form.status,
          description: form.description || undefined,
          foreman: form.foreman || undefined,
          crewCount: form.crew_count ? parseInt(form.crew_count) : undefined,
          nrswaRequired: form.nrswa_required,
          permitNumber: form.permit_number || undefined,
        } as any);
        dispatch({ type: "UPDATE_JOB", id: editingId, updates: toJob(result) });
        setShowModal(false);
        toast.success(`Job ${result.jobNumber} updated`);
      } else {
        const result = await createJob({
          title: form.title.trim(),
          clientId: form.client_id || undefined,
          type: (form.type as JobType) || undefined,
          siteAddress: form.site_address || undefined,
          value: form.value ? parseFloat(form.value) : undefined,
          startDate: form.start_date || undefined,
          endDate: form.end_date || undefined,
          status: form.status,
          progressPercent: 0,
          description: form.description || undefined,
          foreman: form.foreman || undefined,
          crewCount: form.crew_count ? parseInt(form.crew_count) : undefined,
          nrswaRequired: form.nrswa_required,
          permitNumber: form.permit_number || undefined,
        } as any);
        dispatch({ type: "ADD_JOB", job: toJob(result) });
        setShowModal(false);
        toast.success(`Job ${result.jobNumber} created`);
      }
    } catch {
      toast.error(editingId ? "Failed to update job" : "Failed to create job");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const headers = [
      "Job No",
      "Title",
      "Client",
      "Type",
      "Status",
      "Value",
      "Progress",
      "Start Date",
    ];
    const rows = filtered.map((j) => [
      j.job_number,
      j.title,
      j.client?.company_name ?? "",
      j.type ?? "",
      j.status,
      (j.value ?? 0).toFixed(2),
      j.progress_percent,
      j.start_date ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  async function updateStatus(id: string, status: JobStatus) {
    const prev = jobs.find((j) => j.id === id);
    dispatch({ type: "UPDATE_JOB", id, updates: { status } });
    try {
      await updateJob(id, { status });
    } catch {
      if (prev)
        dispatch({ type: "UPDATE_JOB", id, updates: { status: prev.status } });
      toast.error("Failed to update status");
    }
  }

  function updateProgress(id: string, progress_percent: number) {
    const prev = jobs.find((j) => j.id === id);
    dispatch({ type: "UPDATE_JOB", id, updates: { progress_percent } });
    clearTimeout(progressTimer.current ?? undefined);
    progressTimer.current = setTimeout(async () => {
      try {
        await updateJob(id, { progressPercent: progress_percent });
      } catch {
        if (prev)
          dispatch({
            type: "UPDATE_JOB",
            id,
            updates: { progress_percent: prev.progress_percent },
          });
        toast.error("Failed to save progress");
      }
    }, 800);
  }

  async function handleDelete(id: string, jobNumber: string) {
    if (!confirm(`Delete job ${jobNumber}? This cannot be undone.`)) return;
    try {
      await deleteJob(id);
      dispatch({ type: "REMOVE_JOB", id });
      setSelected(null);
      toast.success(`Job ${jobNumber} deleted`);
    } catch {
      toast.error("Failed to delete job");
    }
  }

  const selectedJob = selected ? jobs.find((j) => j.id === selected) : null;
  const activeJobs = jobs.filter((j) => j.status === "active");
  const activeValue = activeJobs.reduce((sum, j) => sum + (j.value ?? 0), 0);
  const totalPipeline = jobs
    .filter((j) => j.status !== "cancelled")
    .reduce((sum, j) => sum + (j.value ?? 0), 0);
  const completedJobs = jobs.filter((j) => j.status === "complete");

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Jobs
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            <span className="font-mono font-medium">{jobs.length}</span> total
            registered
          </p>
        </div>
        <Btn onClick={openNew}>
          <Plus className="w-4 h-4" strokeWidth={1.5} /> New Job
        </Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pipeline"
          value={formatCurrency(totalPipeline)}
          sub={`${jobs.length} total jobs`}
        />
        <StatCard
          accent
          label="Active Value"
          value={formatCurrency(activeValue)}
          sub={`${activeJobs.length} active jobs`}
        />
        <StatCard
          label="Active Jobs"
          value={activeJobs.length}
          sub="Currently in progress"
        />
        <StatCard
          label="Completed"
          value={completedJobs.length}
          sub="Successfully delivered"
        />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div
          className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {TABS.map((tab) => {
            const count =
              tab.id === "all"
                ? jobs.length
                : jobs.filter((j) => j.status === tab.id).length;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2 text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5"
                style={
                  isActive
                    ? {
                        color: "var(--ink)",
                        fontWeight: 500,
                        borderBottom: "2px solid var(--accent)",
                        marginBottom: "-1px",
                      }
                    : { color: "var(--muted)" }
                }
              >
                {tab.label}
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
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "#c0bab4" }}
            strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm w-full focus:outline-none transition-colors"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--ink)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>
          <Btn
            variant={filterTypes.length > 0 ? "primary" : "outline"}
            size="sm"
            onClick={() => setShowFilters((f) => !f)}
            className="flex-shrink-0"
          >
            <Filter className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Filter</span>
            {filterTypes.length > 0 && (
              <span className="ml-1 text-[10px] bg-white/20 px-1.5 font-mono">
                {filterTypes.length}
              </span>
            )}
          </Btn>
          <Btn
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Export</span>
          </Btn>
        </div>
      </div>

      {showFilters && (
        <div
          className="p-4 "
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{
                color: "var(--muted)",
                fontFamily: "var(--font-heading)",
              }}
            >
              Filter by type
            </span>
            {filterTypes.length > 0 && (
              <button
                className="text-xs hover:text-[var(--ink)] transition-colors"
                style={{ color: "var(--muted-2)" }}
                onClick={() => setFilterTypes([])}
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {JOB_TYPES.map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 text-sm cursor-pointer group"
              >
                <div
                  className="relative flex items-center justify-center w-4 h-4 border transition-colors"
                  style={{
                    borderColor: filterTypes.includes(t)
                      ? "var(--accent)"
                      : "var(--border)",
                    backgroundColor: filterTypes.includes(t)
                      ? "var(--accent)"
                      : "#ffffff",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filterTypes.includes(t)}
                    onChange={(e) =>
                      setFilterTypes((prev) =>
                        e.target.checked
                          ? [...prev, t]
                          : prev.filter((v) => v !== t),
                      )
                    }
                    className="absolute opacity-0 w-full h-full cursor-pointer"
                  />
                  {filterTypes.includes(t) && (
                    <svg
                      viewBox="0 0 14 14"
                      fill="none"
                      className="w-3 h-3 text-white"
                    >
                      <path
                        d="M3 7.5L5.5 10L11 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span
                  style={{
                    color: filterTypes.includes(t) ? "var(--ink)" : "var(--muted-2)",
                  }}
                  className="capitalize transition-colors group-hover:text-[var(--ink)]"
                >
                  {t}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className={selectedJob ? "xl:col-span-2" : "xl:col-span-3"}>
          <Panel
            title="Job Register"
            badge={
              filtered.length !== jobs.length
                ? `${filtered.length} matching`
                : undefined
            }
            noPad
          >
            {filtered.length === 0 ? (
              jobs.length === 0 ? (
                <EmptyState
                  icon={HardHat}
                  title="No jobs yet"
                  description="Jobs track a piece of work from first enquiry through to completion — status, crew, progress and value all live here."
                  primaryLabel="Create your first job"
                  onPrimary={openNew}
                  secondaryLabel="Import from spreadsheet"
                  onSecondary={() => navigate("/import")}
                  hint="You can also import an existing job list as a CSV."
                />
              ) : (
                <EmptyState
                  icon={Search}
                  title="No jobs match your filters"
                  description="Try a different search term, clear the type filter, or switch tabs."
                  primaryLabel="Clear filters"
                  onPrimary={() => {
                    setActiveTab("all");
                    setSearch("");
                    setFilterTypes([]);
                  }}
                />
              )
            ) : (
              <div className="flex flex-col">
                {filtered.map((job, i) => (
                  <div
                    key={job.id}
                    onClick={() =>
                      setSelected(selected === job.id ? null : job.id)
                    }
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[var(--surface-2)] group"
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      backgroundColor:
                        selected === job.id ? "var(--surface-2)" : undefined,
                      borderLeft:
                        selected === job.id
                          ? "3px solid var(--accent)"
                          : "3px solid transparent",
                    }}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "var(--surface-3)" }}
                      >
                        <HardHat
                          className="w-4 h-4"
                          style={{ color: "var(--muted)" }}
                          strokeWidth={1.5}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                          <span
                            className="text-sm font-semibold truncate transition-colors group-hover:text-[var(--accent)]"
                            style={{ color: "var(--ink)" }}
                          >
                            {job.title}
                          </span>
                          {job.client?.company_name && (
                            <span
                              className="flex-shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                backgroundColor: "var(--surface-3)",
                                color: "var(--ink-2)",
                              }}
                            >
                              {job.client.company_name}
                            </span>
                          )}
                          <span className="sm:hidden">
                            <Badge status={job.status} />
                          </span>
                        </div>
                        <div
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          <span className="font-mono font-medium">
                            {job.job_number}
                          </span>
                          {job.site_address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 opacity-70" strokeWidth={1.5} />{" "}
                              {job.site_address.split(",")[0]}
                            </span>
                          )}
                          {job.type && (
                            <span className="capitalize opacity-80">
                              · {job.type.replace("_", " ")}
                            </span>
                          )}
                        </div>
                        {job.status === "active" && (
                          <div className="sm:hidden mt-2 max-w-[200px]">
                            <div className="flex justify-between items-center mb-1">
                              <span
                                className="text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: "var(--muted)" }}
                              >
                                Progress
                              </span>
                              <span
                                className="text-[11px] font-bold tnum"
                                style={{ color: "#2a6e45" }}
                              >
                                {job.progress_percent}%
                              </span>
                            </div>
                            <div
                              className="h-1.5 overflow-hidden"
                              style={{ backgroundColor: "var(--surface-3)" }}
                            >
                              <div
                                className="h-full"
                                style={{
                                  width: `${job.progress_percent}%`,
                                  backgroundColor: "#2a6e45",
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 pl-12 sm:pl-0 flex-shrink-0">
                      <span className="hidden sm:block">
                        <Badge status={job.status} />
                      </span>
                      {job.status === "active" && (
                        <div className="w-32 hidden sm:block flex-shrink-0">
                          <div className="flex justify-between items-center mb-1.5">
                            <span
                              className="text-[10px] font-bold uppercase tracking-widest"
                              style={{ color: "var(--muted)" }}
                            >
                              Progress
                            </span>
                            <span
                              className="text-[11px] font-bold tnum"
                              style={{ color: "#2a6e45" }}
                            >
                              {job.progress_percent}%
                            </span>
                          </div>
                          <div
                            className="h-1.5 overflow-hidden"
                            style={{ backgroundColor: "var(--surface-3)" }}
                          >
                            <div
                              className="h-full"
                              style={{
                                width: `${job.progress_percent}%`,
                                backgroundColor: "#2a6e45",
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="w-28 flex-shrink-0 text-right">
                        <div
                          className="text-[10px] font-bold uppercase tracking-widest mb-1"
                          style={{ color: "var(--muted)" }}
                        >
                          Value
                        </div>
                        <div
                          className="text-sm font-medium tnum"
                          style={{ color: "var(--ink)" }}
                        >
                          {job.value ? formatCurrency(job.value) : "—"}
                        </div>
                      </div>
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 flex-shrink-0 transition-all hidden sm:block",
                          selected === job.id
                            ? "opacity-100 text-[var(--accent)] rotate-90"
                            : "opacity-0 group-hover:opacity-100 text-[var(--muted)]",
                        )}
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {selectedJob && (
          <div className="sticky top-6">
            <Panel
              actions={
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(selectedJob)}
                    className="px-2 py-1 hover:bg-[var(--surface-3)] transition-colors text-xs font-medium"
                    style={{ color: "var(--accent)" }}
                    title="Edit job"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      handleDelete(selectedJob.id, selectedJob.job_number)
                    }
                    className="p-1 hover:bg-red-50 transition-colors"
                    style={{ color: "var(--danger)" }}
                    title="Delete job"
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
                  <div className="flex items-center gap-2.5 mb-2">
                    <span
                      className="text-xs font-mono font-medium px-2 py-0.5 bg-[var(--surface-3)]"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {selectedJob.job_number}
                    </span>
                    <Badge status={selectedJob.status} />
                  </div>
                  <h3
                    className="text-lg font-semibold leading-tight tracking-tight"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {selectedJob.title}
                  </h3>
                </div>

                <div>
                  <p
                    className="text-[11px] font-bold uppercase tracking-widest mb-2.5"
                    style={{
                      color: "var(--muted)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    Status Workflow
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {JOB_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedJob.id, s)}
                        className="px-3 py-1.5 text-xs transition-colors capitalize font-medium"
                        style={
                          selectedJob.status === s
                            ? {
                                backgroundColor: "var(--accent)",
                                color: "#ffffff",
                                border: "1px solid var(--accent)",
                              }
                            : {
                                backgroundColor: "var(--surface)",
                                color: "var(--muted)",
                                border: "1px solid var(--border)",
                              }
                        }
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedJob.status === "active" && (
                  <div
                    className="p-4 bg-[var(--surface)]"
                    style={{ border: "1px solid var(--surface-3)" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p
                        className="text-[11px] font-bold uppercase tracking-widest"
                        style={{
                          color: "var(--muted)",
                          fontFamily: "var(--font-heading)",
                        }}
                      >
                        Job Progress
                      </p>
                      <span className="text-sm font-bold font-mono text-[#2a6e45]">
                        {selectedJob.progress_percent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={selectedJob.progress_percent}
                      onChange={(e) =>
                        updateProgress(selectedJob.id, parseInt(e.target.value))
                      }
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                    <div
                      className="mt-3 h-2 overflow-hidden"
                      style={{ backgroundColor: "var(--surface-3)" }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${selectedJob.progress_percent}%`,
                          backgroundColor: "#2a6e45",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <p
                    className="text-[11px] font-bold uppercase tracking-widest mb-3"
                    style={{
                      color: "var(--muted)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    Job Details
                  </p>
                  <div
                    className="space-y-0 text-sm"
                    style={{
                      border: "1px solid var(--surface-3)",
                      overflow: "hidden",
                    }}
                  >
                    {[
                      {
                        label: "Client",
                        value: selectedJob.client?.company_name ?? "—",
                      },
                      {
                        label: "Type",
                        value: selectedJob.type ? (
                          <span className="capitalize">
                            {selectedJob.type.replace("_", " ")}
                          </span>
                        ) : (
                          "—"
                        ),
                      },
                      {
                        label: "Site Address",
                        value: selectedJob.site_address ?? "—",
                      },
                      {
                        label: "Contract Value",
                        value: selectedJob.value ? (
                          <span className="font-mono tnum font-medium">
                            {formatCurrency(selectedJob.value)}
                          </span>
                        ) : (
                          "—"
                        ),
                      },
                      {
                        label: "Start Date",
                        value: selectedJob.start_date ? (
                          <span className="font-mono">
                            {formatDate(selectedJob.start_date)}
                          </span>
                        ) : (
                          "—"
                        ),
                      },
                      { label: "Foreman", value: selectedJob.foreman ?? "—" },
                      {
                        label: "Crew Size",
                        value: selectedJob.crew_count ? (
                          <span className="font-mono">
                            {selectedJob.crew_count} operatives
                          </span>
                        ) : (
                          "—"
                        ),
                      },
                    ].map(({ label, value }, idx) => (
                      <div
                        key={label}
                        className="flex justify-between items-baseline gap-4 px-4 py-2.5"
                        style={{
                          backgroundColor:
                            idx % 2 === 0 ? "var(--surface)" : "#f5f1ec",
                        }}
                      >
                        <span style={{ color: "var(--muted)", flexShrink: 0 }}>
                          {label}
                        </span>
                        <span
                          className="text-right font-medium"
                          style={{ color: "var(--ink)" }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedJob.nrswa_required && (
                  <div
                    className="p-3 text-sm flex items-start gap-3"
                    style={{
                      backgroundColor: "var(--accent-bg)",
                      border: "1px solid var(--accent)",
                    }}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-[var(--accent)] mb-0.5">
                        NRSWA Street Works Required
                      </div>
                      <div className="text-[var(--ink-2)]">
                        Permit Ref:{" "}
                        <span className="font-mono font-medium text-[var(--ink)]">
                          {selectedJob.permit_number ?? "Not supplied"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedJob.description && (
                  <div className="pt-2">
                    <p
                      className="text-[11px] font-bold uppercase tracking-widest mb-2"
                      style={{
                        color: "var(--muted)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      Scope of Works
                    </p>
                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap p-4 bg-[var(--surface)]"
                      style={{ color: "var(--ink-2)", border: "1px solid var(--surface-3)" }}
                    >
                      {selectedJob.description}
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
        title={editingId ? "Edit Job" : "New Job"}
      >
        <div className="space-y-4">
          <Field label="Job Title" required>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Drainage Installation — Plot 12"
            />
            {errors.title && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {errors.title}
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as JobStatus,
                  }))
                }
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s
                      .replace("_", " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type">
              <Select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as JobType }))
                }
              >
                <option value="">Select type...</option>
                {JOB_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Client">
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
          </Field>
          <Field label="Site Address">
            <Input
              value={form.site_address}
              onChange={(e) =>
                setForm((f) => ({ ...f, site_address: e.target.value }))
              }
              placeholder="e.g. Longbridge Lane, Birmingham, B31 4SX"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contract Value (£)">
              <Input
                type="number"
                value={form.value}
                onChange={(e) =>
                  setForm((f) => ({ ...f, value: e.target.value }))
                }
                placeholder="0.00"
              />
            </Field>
            <Field label="Crew Count">
              <Input
                type="number"
                value={form.crew_count}
                onChange={(e) =>
                  setForm((f) => ({ ...f, crew_count: e.target.value }))
                }
                placeholder="0"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </Field>
            <Field label="End Date">
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end_date: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Foreman">
            <Input
              value={form.foreman}
              onChange={(e) =>
                setForm((f) => ({ ...f, foreman: e.target.value }))
              }
              placeholder="e.g. Dave Walters"
            />
          </Field>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.nrswa_required}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nrswa_required: e.target.checked }))
                }
                className="w-4 h-4 accent-neutral-400"
              />
              <span className="text-sm" style={{ color: "var(--muted-2)" }}>
                NRSWA Street Works required
              </span>
            </label>
          </div>
          {form.nrswa_required && (
            <Field label="Permit Number">
              <Input
                value={form.permit_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, permit_number: e.target.value }))
                }
                placeholder="e.g. BCC-2024-0892"
              />
            </Field>
          )}
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Scope of works..."
              rows={3}
            />
          </Field>
          <div className="flex gap-3 pt-2">
            <Btn
              className="flex-1 justify-center"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving
                ? editingId
                  ? "Saving…"
                  : "Creating…"
                : editingId
                  ? "Save Changes"
                  : "Create Job"}
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
