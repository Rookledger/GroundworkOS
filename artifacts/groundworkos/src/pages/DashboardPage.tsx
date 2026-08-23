import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  ArrowRight,
  ChevronRight,
  MapPin,
  Briefcase,
  Users,
  Truck,
  FileWarning,
  Activity,
  PlusCircle,
  Edit2,
  Trash2,
} from "lucide-react";
import { Link } from "wouter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Btn } from "../components/ui/Btn";
import { formatCurrency, formatDate } from "../lib/utils";
import { useApp } from "../store/AppContext";
import { useRole, isAtLeast } from "../hooks/useRole";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DashboardStats {
  pendingQuotes: number;
  activeSubcons: number;
  plantCount: number;
  docAlerts: number;
}

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, any> | null;
  user_name: string | null;
  created_at: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2.5 rounded-lg gw-shadow text-xs"
      style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
    >
      <div
        className="font-medium mb-1.5"
        style={{ color: "#181410", fontFamily: "'Inter', sans-serif" }}
      >
        {label}
      </div>
      {payload.map((p: any) => (
        <div
          key={p.name}
          className="flex items-center justify-between gap-4 mb-0.5"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span style={{ color: "#7a7469" }}>{p.name}</span>
          </div>
          <span
            className="tnum"
            style={{
              color: "#181410",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {typeof p.value === "number" ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ENTITY_LABELS: Record<string, string> = {
  job: "Job",
  quote: "Quote",
  invoice: "Invoice",
  client: "Client",
  subcontractor: "Subcon",
  document: "Document",
  plant: "Plant",
  timesheet: "Timesheet",
  purchase_order: "Purchase Order",
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  create: <PlusCircle className="w-3.5 h-3.5" style={{ color: "#2a6e45" }} />,
  update: <Edit2 className="w-3.5 h-3.5" style={{ color: "#1b5e78" }} />,
  delete: <Trash2 className="w-3.5 h-3.5" style={{ color: "#c13a2a" }} />,
};

const ACTION_COLOR: Record<string, string> = {
  create: "#2a6e45",
  update: "#1b5e78",
  delete: "#c13a2a",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getChangeSummary(
  action: string,
  changes: Record<string, any> | null,
): string {
  if (action === "delete") return "deleted";
  if (!changes || typeof changes !== "object")
    return action === "create" ? "created" : "updated";
  const keys = Object.keys(changes).filter(
    (k) => !["id", "created_at", "updated_at"].includes(k),
  );
  if (keys.length === 0) return action === "create" ? "created" : "updated";
  if (action === "create") return `created`;
  return `updated ${keys.slice(0, 2).join(", ")}${keys.length > 2 ? ` +${keys.length - 2}` : ""}`;
}

export function DashboardPage() {
  const { state } = useApp();
  const { jobs, invoices, documents } = state;

  const [extraStats, setExtraStats] = useState<DashboardStats | null>(null);
  const [activityFeed, setActivityFeed] = useState<AuditEntry[]>([]);
  const role = useRole();
  const isAdmin = isAtLeast(role, "admin");

  useEffect(() => {
    fetch(`${BASE}/api/dashboard`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setExtraStats(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // The audit trail is admin-only; skip the fetch for non-admins so the
    // Recent Activity panel isn't populated (or 403'd) for them.
    if (!isAdmin) return;
    fetch(`${BASE}/api/audit-logs?limit=10&days=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AuditEntry[] | null) => {
        if (data) setActivityFeed(data);
      })
      .catch(() => {});
  }, [isAdmin]);

  const activeJobs = jobs.filter((j) => j.status === "active");
  const outstandingInvoices = invoices.filter(
    (i) => i.status === "sent" || i.status === "overdue",
  );
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalOutstanding = outstandingInvoices.reduce(
    (s, i) => s + i.total_amount,
    0,
  );
  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.total_amount, 0);
  const totalCollected = paidInvoices.reduce((s, i) => s + i.total_amount, 0);
  const totalPipeline = jobs
    .filter((j) => j.status !== "cancelled")
    .reduce((s, j) => s + (j.value ?? 0), 0);
  const expiringDocs = documents.filter((d) => d.status === "expiring_soon");
  const expiredDocs = documents.filter((d) => d.status === "expired");
  const complianceDocs = [...expiredDocs, ...expiringDocs];

  const monthMap = new Map<
    string,
    { invoiced: number; collected: number; month: string }
  >();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "short" });
    monthMap.set(key, { invoiced: 0, collected: 0, month: label });
  }
  for (const inv of invoices) {
    const key = inv.issued_date?.slice(0, 7) ?? "";
    if (monthMap.has(key)) monthMap.get(key)!.invoiced += inv.total_amount;
  }
  for (const inv of paidInvoices) {
    if (!inv.paid_at) continue;
    const key = inv.paid_at.slice(0, 7);
    if (monthMap.has(key)) monthMap.get(key)!.collected += inv.total_amount;
  }
  const revenueData = Array.from(monthMap.values());

  const alertCount = overdueInvoices.length + complianceDocs.length;
  const hasAlerts = alertCount > 0;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          accent
          label="Pipeline"
          value={formatCurrency(totalPipeline)}
          sub={`${activeJobs.length} active jobs`}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(totalCollected)}
          sub={`${paidInvoices.length} paid invoices`}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(totalOutstanding)}
          sub={`${outstandingInvoices.length} invoices`}
        />
        <StatCard
          danger={overdueInvoices.length > 0}
          label="Overdue"
          value={formatCurrency(totalOverdue)}
          sub={`${overdueInvoices.length} overdue`}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/jobs">
          <div
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#e8f3f7" }}
            >
              <Briefcase className="w-4 h-4" style={{ color: "#1b5e78" }} />
            </div>
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-0.5"
                style={{
                  color: "#7a7469",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Quotes Pending
              </div>
              <div
                className="text-xl font-bold"
                style={{
                  color: "#181410",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {extraStats
                  ? extraStats.pendingQuotes
                  : jobs.filter((j) => j.status === "quoted").length}
              </div>
            </div>
          </div>
        </Link>
        <Link href="/subcontractors">
          <div
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#f0fdf4" }}
            >
              <Users className="w-4 h-4" style={{ color: "#2a6e45" }} />
            </div>
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-0.5"
                style={{
                  color: "#7a7469",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Active Subcons
              </div>
              <div
                className="text-xl font-bold"
                style={{
                  color: "#181410",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {extraStats?.activeSubcons ?? "—"}
              </div>
            </div>
          </div>
        </Link>
        <Link href="/plant">
          <div
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#fef9f0" }}
            >
              <Truck className="w-4 h-4" style={{ color: "#b56918" }} />
            </div>
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-0.5"
                style={{
                  color: "#7a7469",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Plant Items
              </div>
              <div
                className="text-xl font-bold"
                style={{
                  color: "#181410",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {extraStats?.plantCount ?? "—"}
              </div>
            </div>
          </div>
        </Link>
        <Link href="/documents">
          <div
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor:
                  complianceDocs.length > 0 ? "#fff5f5" : "#f0fdf4",
              }}
            >
              <FileWarning
                className="w-4 h-4"
                style={{
                  color: complianceDocs.length > 0 ? "#c13a2a" : "#2a6e45",
                }}
              />
            </div>
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-0.5"
                style={{
                  color: "#7a7469",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Doc Alerts
              </div>
              <div
                className="text-xl font-bold"
                style={{
                  color: complianceDocs.length > 0 ? "#c13a2a" : "#181410",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {complianceDocs.length}
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Panel
            title="Revenue vs Collected — Last 6 Months"
            actions={
              <Link href="/reports">
                <Btn variant="ghost" size="sm">
                  Reports <ArrowRight className="w-3 h-3" />
                </Btn>
              </Link>
            }
          >
            <div style={{ height: 240 }} className="mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={revenueData}
                  barGap={6}
                  barCategoryGap="30%"
                  margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="#e8e4dd"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{
                      fill: "#7a7469",
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    tick={{
                      fill: "#7a7469",
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v === 0 ? "" : `£${(v / 1000).toFixed(0)}k`
                    }
                    width={40}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "#eeeae4", opacity: 0.5 }}
                  />
                  <Bar
                    dataKey="invoiced"
                    name="Invoiced"
                    fill="#e0dbd5"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                  />
                  <Bar
                    dataKey="collected"
                    name="Collected"
                    fill="#2a6e45"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div
              className="flex items-center gap-6 mt-5 pt-4"
              style={{ borderTop: "1px solid #d9d4ce" }}
            >
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "#7a7469" }}
              >
                <span
                  className="w-3 h-3 rounded-sm inline-block"
                  style={{ backgroundColor: "#e0dbd5" }}
                />{" "}
                Invoiced
              </div>
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "#7a7469" }}
              >
                <span
                  className="w-3 h-3 rounded-sm inline-block"
                  style={{ backgroundColor: "#2a6e45" }}
                />{" "}
                Collected
              </div>
            </div>
          </Panel>

          <Panel
            title="Active Jobs"
            actions={
              <Link href="/jobs">
                <Btn variant="ghost" size="sm">
                  All jobs <ArrowRight className="w-3 h-3" />
                </Btn>
              </Link>
            }
            noPad
          >
            {activeJobs.length === 0 ? (
              <p
                className="text-sm text-center py-10"
                style={{ color: "#a8a099" }}
              >
                No active jobs
              </p>
            ) : (
              <div>
                {activeJobs.slice(0, 6).map((job, i) => (
                  <Link key={job.id} href="/jobs">
                    <div
                      className="flex items-center gap-5 px-5 py-4 transition-colors hover:bg-[#eeeae4] cursor-pointer group"
                      style={{
                        borderBottom:
                          i < Math.min(activeJobs.length, 6) - 1
                            ? "1px solid #d9d4ce"
                            : "none",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <span
                            className="text-sm font-semibold truncate"
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
                        </div>
                        <div
                          className="flex items-center gap-3 text-xs"
                          style={{ color: "#7a7469" }}
                        >
                          <span className="font-mono">{job.job_number}</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{" "}
                            {job.site_address
                              ? job.site_address.split(",")[0]
                              : "Site active"}
                          </span>
                        </div>
                      </div>
                      <div className="w-32 hidden sm:block flex-shrink-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: "#7a7469" }}
                          >
                            Progress
                          </span>
                          <span
                            className="text-xs font-bold font-mono"
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
                      <ChevronRight
                        className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "#7a7469" }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Action Required"
            badge={hasAlerts ? alertCount : undefined}
          >
            {!hasAlerts && (
              <p
                className="text-sm text-center py-6"
                style={{ color: "#a8a099" }}
              >
                All clear — no outstanding actions
              </p>
            )}

            {overdueInvoices.length > 0 && (
              <div className="mb-5">
                <h4
                  className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest mb-3"
                  style={{
                    color: "#7a7469",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  <AlertTriangle
                    className="w-3.5 h-3.5"
                    style={{ color: "#c13a2a" }}
                  />{" "}
                  Overdue Invoices
                </h4>
                <div className="space-y-2">
                  {overdueInvoices.slice(0, 4).map((inv) => (
                    <Link key={inv.id} href="/invoices">
                      <div
                        className="flex items-center justify-between p-3 rounded-lg cursor-pointer group transition-colors"
                        style={{
                          backgroundColor: "#eeeae4",
                          border: "1px solid rgba(193,58,42,0.18)",
                        }}
                      >
                        <div className="min-w-0">
                          <div
                            className="text-sm font-bold font-mono truncate"
                            style={{ color: "#c13a2a" }}
                          >
                            {inv.invoice_number}
                          </div>
                          <div
                            className="text-xs mt-0.5 truncate"
                            style={{ color: "#7a7469" }}
                          >
                            {inv.client?.company_name ?? "—"}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <div
                            className="text-sm font-bold font-mono tnum"
                            style={{ color: "#181410" }}
                          >
                            {formatCurrency(inv.total_amount)}
                          </div>
                          <div
                            className="text-[10px] font-medium mt-0.5 flex items-center justify-end gap-1"
                            style={{ color: "#c13a2a" }}
                          >
                            Review{" "}
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {complianceDocs.length > 0 && (
              <div>
                <h4
                  className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest mb-3"
                  style={{
                    color: "#7a7469",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  <ShieldAlert
                    className="w-3.5 h-3.5"
                    style={{ color: "#b56918" }}
                  />{" "}
                  Compliance Lapsing
                </h4>
                <div className="space-y-2">
                  {complianceDocs.slice(0, 4).map((doc) => (
                    <Link key={doc.id} href="/documents">
                      <div
                        className="flex items-start gap-3 p-3 rounded-lg cursor-pointer group transition-colors hover:bg-[#eeeae4]"
                        style={{ border: "1px solid #d9d4ce" }}
                      >
                        <span
                          className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              doc.status === "expired" ? "#c13a2a" : "#b56918",
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-medium leading-tight truncate transition-colors group-hover:text-[#1b5e78]"
                            style={{ color: "#181410" }}
                          >
                            {doc.name}
                          </div>
                          <div
                            className="text-xs font-mono mt-1.5 flex items-center gap-1.5"
                            style={{
                              color:
                                doc.status === "expired"
                                  ? "#c13a2a"
                                  : "#b56918",
                            }}
                          >
                            <Clock className="w-3 h-3" />
                            {doc.status === "expired"
                              ? "Expired"
                              : "Expiring"}{" "}
                            {formatDate(doc.expiry_date)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {isAdmin && (
            <Panel
              title="Recent Activity"
              actions={
                <Link href="/audit">
                  <Btn variant="ghost" size="sm">
                    Full log <ArrowRight className="w-3 h-3" />
                  </Btn>
                </Link>
              }
            >
              {activityFeed.length === 0 ? (
                <p
                  className="text-sm text-center py-6"
                  style={{ color: "#a8a099" }}
                >
                  No recent activity
                </p>
              ) : (
                <div className="space-y-0 -mx-5 -mb-5">
                  {activityFeed.map((entry, i) => {
                    const icon = ACTION_ICON[entry.action] ?? (
                      <Activity
                        className="w-3.5 h-3.5"
                        style={{ color: "#7a7469" }}
                      />
                    );
                    const color = ACTION_COLOR[entry.action] ?? "#7a7469";
                    const entityLabel =
                      ENTITY_LABELS[entry.entity_type] ?? entry.entity_type;
                    const summary = getChangeSummary(
                      entry.action,
                      entry.changes,
                    );
                    return (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#eeeae4]"
                        style={{
                          borderTop: i > 0 ? "1px solid #e8e4dd" : "none",
                        }}
                      >
                        <div
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: "#eeeae4",
                                color: "#4a4540",
                              }}
                            >
                              {entityLabel}
                            </span>
                            <span
                              className="text-sm"
                              style={{ color: "#4a4540" }}
                            >
                              {summary}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {entry.user_name && (
                              <span
                                className="text-xs font-medium"
                                style={{ color: "#7a7469" }}
                              >
                                {entry.user_name}
                              </span>
                            )}
                            <span
                              className="text-xs font-mono"
                              style={{ color: "#a8a099" }}
                            >
                              {timeAgo(entry.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
