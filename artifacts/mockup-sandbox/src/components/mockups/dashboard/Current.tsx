import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Receipt,
  Calendar,
  Users,
  HardHat,
  FolderOpen,
  BarChart3,
  Settings,
  Bell,
  Search,
  LogOut,
  Truck,
  AlertTriangle,
  ShieldAlert,
  Clock,
  ArrowRight,
  ChevronRight,
  MapPin,
  FileWarning,
  PlusCircle,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import "./_group.css";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(v);
const NAV = [
  { name: "Dashboard", icon: LayoutDashboard, active: true },
  { name: "Jobs", icon: Briefcase },
  { name: "Schedule", icon: Calendar },
  { name: "Quotes", icon: FileText },
  { name: "Invoices", icon: Receipt },
  { name: "Clients", icon: Users },
  { name: "Subcontractors", icon: HardHat },
  { name: "Documents", icon: FolderOpen },
  { name: "Plant", icon: Truck },
  { name: "Reports", icon: BarChart3 },
  { name: "Settings", icon: Settings },
];

const JOBS = [
  {
    id: 1,
    title: "Foul & surface water drainage — Phase 2",
    client: "Barratt Homes",
    job_number: "JB-2041",
    site: "Plot 14-22, Wickford",
    progress: 72,
    value: 284000,
  },
  {
    id: 2,
    title: "Strip & trench foundations, Plot 14-22",
    client: "Persimmon",
    job_number: "JB-2038",
    site: "Chelmsford Road",
    progress: 45,
    value: 196500,
  },
  {
    id: 3,
    title: "S278 highway kerbing & footways",
    client: "Galliford Try",
    job_number: "JB-2035",
    site: "A414 Interchange",
    progress: 88,
    value: 342000,
  },
  {
    id: 4,
    title: "Bulk muck-away & reduced dig",
    client: "Taylor Wimpey",
    job_number: "JB-2029",
    site: "Brentwood North",
    progress: 30,
    value: 158000,
  },
];

const OVERDUE_INVOICES = [
  { id: "INV-2041", client: "Persimmon", amount: 38200 },
  { id: "INV-2033", client: "Wates", amount: 29800 },
];

const COMPLIANCE = [
  {
    id: 1,
    name: "Public Liability — Murphy Plant Hire",
    status: "expired",
    date: "18 Jun 2026",
  },
  {
    id: 2,
    name: "CSCS card — J. O'Connor",
    status: "expiring",
    date: "02 Jul 2026",
  },
  {
    id: 3,
    name: "RAMS — Sewer Connection Plot 9",
    status: "expiring",
    date: "05 Jul 2026",
  },
];

const ACTIVITY = [
  {
    id: 1,
    entity: "Job",
    action: "update",
    summary: "updated progress_percent",
    user: "D. Smith",
    time: "12m ago",
  },
  {
    id: 2,
    entity: "Invoice",
    action: "create",
    summary: "created",
    user: "M. Jones",
    time: "1h ago",
  },
  {
    id: 3,
    entity: "Document",
    action: "update",
    summary: "updated expiry_date",
    user: "System",
    time: "3h ago",
  },
  {
    id: 4,
    entity: "Quote",
    action: "delete",
    summary: "deleted",
    user: "A. Patel",
    time: "5h ago",
  },
];

const REVENUE_DATA = [
  { month: "Jan", invoiced: 312000, collected: 280000 },
  { month: "Feb", invoiced: 358000, collected: 331000 },
  { month: "Mar", invoiced: 402000, collected: 377000 },
  { month: "Apr", invoiced: 388000, collected: 362000 },
  { month: "May", invoiced: 441000, collected: 410000 },
  { month: "Jun", invoiced: 470000, collected: 295000 },
];

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

function Panel({
  title,
  actions,
  badge,
  children,
  noPad,
}: {
  title?: string;
  actions?: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "#fafaf8",
        border: "1px solid #d9d4ce",
        boxShadow: "0 1px 3px 0 rgba(24,20,16,0.08)",
      }}
    >
      {title && (
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: "1px solid #d9d4ce" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <h3
              className="truncate"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: "-0.01em",
                color: "#181410",
              }}
            >
              {title}
            </h3>
            {badge !== undefined && (
              <span
                className="flex-shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "rgba(193,58,42,0.1)",
                  color: "#c13a2a",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {badge}
              </span>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={noPad ? "" : "p-5"}>{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className="relative p-5 rounded-xl overflow-hidden"
      style={{
        backgroundColor: "#fafaf8",
        border: danger ? "1px solid rgba(193,58,42,0.3)" : "1px solid #d9d4ce",
        boxShadow: "0 1px 3px 0 rgba(24,20,16,0.08)",
      }}
    >
      {danger && (
        <div
          className="absolute top-0 left-0 w-full"
          style={{ height: 3, backgroundColor: "#c13a2a" }}
        />
      )}
      {accent && !danger && (
        <div
          className="absolute top-0 left-0 w-full"
          style={{ height: 3, backgroundColor: "#1b5e78" }}
        />
      )}
      <p
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 600,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#7a7469",
          marginBottom: 12,
        }}
      >
        {label}
      </p>
      <p
        className="tnum"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          fontSize: 28,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: danger ? "#c13a2a" : "#181410",
          marginBottom: sub ? 8 : 0,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 12, color: "#7a7469", fontWeight: 500 }}>{sub}</p>
      )}
    </div>
  );
}

function Btn({
  children,
  variant = "ghost",
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: "#1b5e78", color: "#fff" },
    ghost: { backgroundColor: "transparent", color: "#7a7469" },
  };
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs"
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 600,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2.5 rounded-lg text-xs"
      style={{
        backgroundColor: "#fafaf8",
        border: "1px solid #d9d4ce",
        boxShadow: "0 4px 12px rgba(24,20,16,0.1)",
      }}
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
            {formatCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Current() {
  const [, setBellOpen] = useState(false);

  return (
    <div
      className="gw-root flex h-[1080px] w-[1920px] overflow-hidden"
      style={{ backgroundColor: "#f0ede8", color: "#181410" }}
    >
      <aside
        className="w-56 flex flex-col flex-shrink-0"
        style={{ backgroundColor: "#fafaf8", borderRight: "1px solid #d9d4ce" }}
      >
        <div
          className="h-13 flex items-center gap-2.5 px-4 py-3"
          style={{ borderBottom: "1px solid #d9d4ce" }}
        >
          <div
            className="w-7 h-7 flex items-center justify-center flex-shrink-0"
            style={{ border: "1.5px solid #1b5e78", borderRadius: 4 }}
          >
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                color: "#1b5e78",
                lineHeight: 1,
              }}
            >
              G
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.04em",
            }}
          >
            GROUNDWORK<span style={{ color: "#1b5e78" }}>OS</span>
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map((item) => (
            <div
              key={item.name}
              className="relative flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium mb-0.5"
              style={{
                backgroundColor: item.active ? "#eeeae4" : "transparent",
                color: item.active ? "#181410" : "#4a4540",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {item.active && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
                  style={{ width: 3, height: 16, backgroundColor: "#1b5e78" }}
                />
              )}
              <item.icon
                className="w-4 h-4 flex-shrink-0"
                style={{ opacity: item.active ? 1 : 0.65 }}
              />
              <span>{item.name}</span>
            </div>
          ))}
        </nav>
        <div className="px-2 py-3" style={{ borderTop: "1px solid #d9d4ce" }}>
          <div className="px-2 py-2 rounded-md flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                backgroundColor: "#1b5e78",
                color: "#fff",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              DS
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-semibold truncate"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                D. Smith
              </p>
              <p
                className="text-[10px] truncate"
                style={{
                  color: "#7a7469",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                d.smith@site.co.uk
              </p>
            </div>
            <LogOut
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: "#a8a099" }}
            />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="h-14 flex items-center justify-between px-6 flex-shrink-0"
          style={{
            backgroundColor: "#fafaf8",
            borderBottom: "1px solid #d9d4ce",
          }}
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 17,
              letterSpacing: "-0.01em",
            }}
          >
            Dashboard
          </span>
          <div className="flex items-center gap-2">
            <div
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded"
              style={{
                backgroundColor: "#eeeae4",
                border: "1px solid #d9d4ce",
                color: "#7a7469",
              }}
            >
              <Search className="w-3 h-3" />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                }}
              >
                Search
              </span>
            </div>
            <button
              onClick={() => setBellOpen((o) => !o)}
              className="relative p-2 rounded"
              style={{ color: "#c13a2a" }}
            >
              <Bell className="w-4 h-4" />
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  backgroundColor: "#c13a2a",
                  color: "#fff",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                3
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                accent
                label="Pipeline"
                value={formatCurrency(2870000)}
                sub="14 active jobs"
              />
              <StatCard
                label="Collected"
                value={formatCurrency(1655000)}
                sub="38 paid invoices"
              />
              <StatCard
                label="Outstanding"
                value={formatCurrency(214300)}
                sub="9 invoices"
              />
              <StatCard
                danger
                label="Overdue"
                value={formatCurrency(68000)}
                sub="2 overdue"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Quotes Pending",
                  value: 6,
                  icon: Briefcase,
                  bg: "#e8f3f7",
                  color: "#1b5e78",
                },
                {
                  label: "Active Subcons",
                  value: 12,
                  icon: Users,
                  bg: "#f0fdf4",
                  color: "#2a6e45",
                },
                {
                  label: "Plant Items",
                  value: 23,
                  icon: Truck,
                  bg: "#fef9f0",
                  color: "#b56918",
                },
                {
                  label: "Doc Alerts",
                  value: 3,
                  icon: FileWarning,
                  bg: "#fff5f5",
                  color: "#c13a2a",
                },
              ].map((q) => (
                <div
                  key={q.label}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
                  style={{
                    backgroundColor: "#fafaf8",
                    border: "1px solid #d9d4ce",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: q.bg }}
                  >
                    <q.icon className="w-4 h-4" style={{ color: q.color }} />
                  </div>
                  <div>
                    <div
                      className="text-xs font-medium uppercase tracking-widest mb-0.5"
                      style={{
                        color: "#7a7469",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {q.label}
                    </div>
                    <div
                      className="text-xl font-bold"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {q.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-6">
                <Panel
                  title="Revenue vs Collected — Last 6 Months"
                  actions={
                    <Btn>
                      Reports <ArrowRight className="w-3 h-3" />
                    </Btn>
                  }
                >
                  <div style={{ height: 240 }} className="mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={REVENUE_DATA}
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
                    <Btn>
                      All jobs <ArrowRight className="w-3 h-3" />
                    </Btn>
                  }
                  noPad
                >
                  <div>
                    {JOBS.map((job, i) => (
                      <div
                        key={job.id}
                        className="flex items-center gap-5 px-5 py-4 group"
                        style={{
                          borderBottom:
                            i < JOBS.length - 1 ? "1px solid #d9d4ce" : "none",
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <span className="text-sm font-semibold truncate">
                              {job.title}
                            </span>
                            <span
                              className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                backgroundColor: "#e8e4dd",
                                color: "#4a4540",
                              }}
                            >
                              {job.client}
                            </span>
                          </div>
                          <div
                            className="flex items-center gap-3 text-xs"
                            style={{ color: "#7a7469" }}
                          >
                            <span className="font-mono">{job.job_number}</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {job.site}
                            </span>
                          </div>
                        </div>
                        <div className="w-32 flex-shrink-0">
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
                              {job.progress}%
                            </span>
                          </div>
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ backgroundColor: "#e8e4dd" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${job.progress}%`,
                                backgroundColor: "#2a6e45",
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-28 flex-shrink-0 text-right">
                          <div
                            className="text-[10px] font-bold uppercase tracking-widest mb-1"
                            style={{ color: "#7a7469" }}
                          >
                            Value
                          </div>
                          <div className="text-sm font-medium font-mono">
                            {formatCurrency(job.value)}
                          </div>
                        </div>
                        <ChevronRight
                          className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100"
                          style={{ color: "#7a7469" }}
                        />
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <div className="space-y-6">
                <Panel title="Action Required" badge={5}>
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
                      {OVERDUE_INVOICES.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-3 rounded-lg"
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
                              {inv.id}
                            </div>
                            <div
                              className="text-xs mt-0.5 truncate"
                              style={{ color: "#7a7469" }}
                            >
                              {inv.client}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <div className="text-sm font-bold font-mono">
                              {formatCurrency(inv.amount)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                      {COMPLIANCE.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-start gap-3 p-3 rounded-lg"
                          style={{ border: "1px solid #d9d4ce" }}
                        >
                          <span
                            className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                doc.status === "expired"
                                  ? "#c13a2a"
                                  : "#b56918",
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-tight truncate">
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
                              <Clock className="w-3 h-3" />{" "}
                              {doc.status === "expired"
                                ? "Expired"
                                : "Expiring"}{" "}
                              {doc.date}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="Recent Activity"
                  actions={
                    <Btn>
                      Full log <ArrowRight className="w-3 h-3" />
                    </Btn>
                  }
                >
                  <div className="space-y-0 -mx-5 -mb-5">
                    {ACTIVITY.map((entry, i) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 px-5 py-3"
                        style={{
                          borderTop: i > 0 ? "1px solid #e8e4dd" : "none",
                        }}
                      >
                        <div
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                          style={{
                            backgroundColor: `${ACTION_COLOR[entry.action]}18`,
                          }}
                        >
                          {ACTION_ICON[entry.action]}
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
                              {entry.entity}
                            </span>
                            <span
                              className="text-sm"
                              style={{ color: "#4a4540" }}
                            >
                              {entry.summary}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-xs font-medium"
                              style={{ color: "#7a7469" }}
                            >
                              {entry.user}
                            </span>
                            <span
                              className="text-xs font-mono"
                              style={{ color: "#a8a099" }}
                            >
                              {entry.time}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
