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
} from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";
import { Btn } from "../components/ui/Btn";
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

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [filterTypes, setFilterTypes] = useState<JobType[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
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
    setForm(emptyForm);
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
    } catch {
      toast.error("Failed to create job");
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
              color: "#181410",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Jobs
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#7a7469" }}>
            <span className="font-mono font-medium">{jobs.length}</span> total
            registered
          </p>
        </div>
        <Btn onClick={openNew}>
          <Plus className="w-4 h-4" /> New Job
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
          style={{ borderBottom: "1px solid #d9d4ce" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 text-sm transition-colors relative whitespace-nowrap"
              style={
                activeTab === tab.id
                  ? {
                      color: "#181410",
                      fontWeight: 500,
                      borderBottom: "2px solid #1b5e78",
                      marginBottom: "-1px",
                    }
                  : { color: "#7a7469" }
              }
            >
              {tab.label}
              {tab.id !== "all" && (
                <span
                  className="text-[11px] ml-1.5 font-mono font-bold"
                  style={{
                    color: activeTab === tab.id ? "#1b5e78" : "#c0bab4",
                  }}
                >
                  {jobs.filter((j) => j.status === tab.id).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "#c0bab4" }}
            />
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-md text-sm w-full focus:outline-none transition-colors"
              style={{
                backgroundColor: "#fafaf8",
                border: "1px solid #d9d4ce",
                color: "#181410",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#1b5e78")}
              onBlur={(e) => (e.target.style.borderColor = "#d9d4ce")}
            />
          </div>
          <Btn
            variant={filterTypes.length > 0 ? "primary" : "outline"}
            size="sm"
            onClick={() => setShowFilters((f) => !f)}
            className="flex-shrink-0"
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filter</span>
            {filterTypes.length > 0 && (
              <span className="ml-1 text-[10px] bg-white/20 px-1.5 rounded font-mono">
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
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Btn>
        </div>
      </div>

      {showFilters && (
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{
                color: "#7a7469",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Filter by type
            </span>
            {filterTypes.length > 0 && (
              <button
                className="text-xs hover:text-[#181410] transition-colors"
                style={{ color: "#8a8377" }}
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
                  className="relative flex items-center justify-center w-4 h-4 rounded border transition-colors"
                  style={{
                    borderColor: filterTypes.includes(t)
                      ? "#1b5e78"
                      : "#d9d4ce",
                    backgroundColor: filterTypes.includes(t)
                      ? "#1b5e78"
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
                    color: filterTypes.includes(t) ? "#181410" : "#8a8377",
                  }}
                  className="capitalize transition-colors group-hover:text-[#181410]"
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
              <div className="text-center py-16">
                <p className="text-sm font-medium" style={{ color: "#4a4540" }}>
                  No jobs found
                </p>
                <p className="text-sm mt-1" style={{ color: "#a8a099" }}>
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((job, i) => (
                  <div
                    key={job.id}
                    onClick={() =>
                      setSelected(selected === job.id ? null : job.id)
                    }
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[#eeeae4] group"
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? "1px solid #d9d4ce" : "none",
                      backgroundColor:
                        selected === job.id ? "#eeeae4" : undefined,
                      borderLeft:
                        selected === job.id
                          ? "3px solid #1b5e78"
                          : "3px solid transparent",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span
                          className="text-sm font-semibold truncate transition-colors group-hover:text-[#1b5e78]"
                          style={{ color: "#181410" }}
                        >
                          {job.title}
                        </span>
                        {job.client?.company_name && (
                          <span
                            className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: "#e8e4dd",
                              color: "#4a4540",
                            }}
                          >
                            {job.client.company_name}
                          </span>
                        )}
                        <Badge status={job.status} />
                      </div>
                      <div
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                        style={{ color: "#7a7469" }}
                      >
                        <span className="font-mono font-medium">
                          {job.job_number}
                        </span>
                        {job.site_address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 opacity-70" />{" "}
                            {job.site_address.split(",")[0]}
                          </span>
                        )}
                        {job.type && (
                          <span className="capitalize opacity-80">
                            · {job.type.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-28 hidden md:block flex-shrink-0 text-right">
                      <div
                        className="text-[10px] font-bold uppercase tracking-widest mb-1"
                        style={{ color: "#7a7469" }}
                      >
                        Value
                      </div>
                      <div
                        className="text-sm font-medium font-mono tnum"
                        style={{ color: "#181410" }}
                      >
                        {job.value ? formatCurrency(job.value) : "—"}
                      </div>
                    </div>
                    {job.status === "active" ? (
                      <div className="w-32 hidden sm:block flex-shrink-0 ml-4">
                        <div className="flex justify-between items-center mb-1.5">
                          <span
                            className="text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: "#7a7469" }}
                          >
                            Progress
                          </span>
                          <span
                            className="text-[11px] font-bold font-mono"
                            style={{ color: "#2a6e45" }}
                          >
                            {job.progress_percent}%
                          </span>
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ backgroundColor: "#e8e4dd" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${job.progress_percent}%`,
                              backgroundColor: "#2a6e45",
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-32 hidden sm:block flex-shrink-0 ml-4" />
                    )}
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 flex-shrink-0 transition-all",
                        selected === job.id
                          ? "opacity-100 text-[#1b5e78] rotate-90"
                          : "opacity-0 group-hover:opacity-100 text-[#7a7469]",
                      )}
                    />
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
                    onClick={() =>
                      handleDelete(selectedJob.id, selectedJob.job_number)
                    }
                    className="p-1 rounded-md hover:bg-red-50 transition-colors"
                    style={{ color: "#c13a2a" }}
                    title="Delete job"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded-md hover:bg-[#e8e4dd] transition-colors"
                    style={{ color: "#7a7469" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              }
            >
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span
                      className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-[#e8e4dd]"
                      style={{ color: "#4a4540" }}
                    >
                      {selectedJob.job_number}
                    </span>
                    <Badge status={selectedJob.status} />
                  </div>
                  <h3
                    className="text-lg font-semibold leading-tight tracking-tight"
                    style={{
                      color: "#181410",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {selectedJob.title}
                  </h3>
                </div>

                <div>
                  <p
                    className="text-[11px] font-bold uppercase tracking-widest mb-2.5"
                    style={{
                      color: "#7a7469",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Status Workflow
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {JOB_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedJob.id, s)}
                        className="px-3 py-1.5 rounded text-xs transition-colors capitalize font-medium"
                        style={
                          selectedJob.status === s
                            ? {
                                backgroundColor: "#1b5e78",
                                color: "#ffffff",
                                border: "1px solid #1b5e78",
                              }
                            : {
                                backgroundColor: "#fafaf8",
                                color: "#7a7469",
                                border: "1px solid #d9d4ce",
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
                    className="p-4 rounded-lg bg-[#fafaf8]"
                    style={{ border: "1px solid #e8e4dd" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p
                        className="text-[11px] font-bold uppercase tracking-widest"
                        style={{
                          color: "#7a7469",
                          fontFamily: "'Space Grotesk', sans-serif",
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
                      className="w-full accent-[#1b5e78] cursor-pointer"
                    />
                    <div
                      className="mt-3 h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: "#e8e4dd" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
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
                      color: "#7a7469",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Job Details
                  </p>
                  <div
                    className="space-y-0 text-sm"
                    style={{
                      border: "1px solid #e8e4dd",
                      borderRadius: "8px",
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
                            idx % 2 === 0 ? "#fafaf8" : "#f5f1ec",
                        }}
                      >
                        <span style={{ color: "#7a7469", flexShrink: 0 }}>
                          {label}
                        </span>
                        <span
                          className="text-right font-medium"
                          style={{ color: "#181410" }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedJob.nrswa_required && (
                  <div
                    className="p-3 rounded-md text-sm flex items-start gap-3"
                    style={{
                      backgroundColor: "#e8f3f7",
                      border: "1px solid #1b5e78",
                    }}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-[#1b5e78] mb-0.5">
                        NRSWA Street Works Required
                      </div>
                      <div className="text-[#4a4540]">
                        Permit Ref:{" "}
                        <span className="font-mono font-medium text-[#181410]">
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
                        color: "#7a7469",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      Scope of Works
                    </p>
                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap p-4 rounded-lg bg-[#fafaf8]"
                      style={{ color: "#4a4540", border: "1px solid #e8e4dd" }}
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
        title="New Job"
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
              <p className="mt-1 text-xs" style={{ color: "#c13a2a" }}>
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
              <span className="text-sm" style={{ color: "#8a8377" }}>
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
              {saving ? "Creating…" : "Create Job"}
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
