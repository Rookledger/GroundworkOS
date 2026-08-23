import React from "react";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Receipt,
  Calendar,
  Users,
  HardHat,
  FolderOpen,
  Truck,
  BarChart3,
  Settings,
  Search,
  Bell,
  AlertTriangle,
  ArrowRight,
  MoreHorizontal,
  ChevronRight,
  MapPin,
  Clock,
  ShieldAlert,
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

// Data
const REVENUE_DATA = [
  { month: "Jan", invoiced: 312000, collected: 280000 },
  { month: "Feb", invoiced: 358000, collected: 331000 },
  { month: "Mar", invoiced: 402000, collected: 377000 },
  { month: "Apr", invoiced: 388000, collected: 362000 },
  { month: "May", invoiced: 441000, collected: 410000 },
  { month: "Jun", invoiced: 470000, collected: 295000 },
];

const ACTIVE_JOBS = [
  {
    id: 1,
    title: "Foul & surface water drainage — Phase 2",
    client: "Barratt Homes",
    progress: 72,
    value: 284000,
  },
  {
    id: 2,
    title: "Strip & trench foundations, Plot 14-22",
    client: "Persimmon",
    progress: 45,
    value: 196500,
  },
  {
    id: 3,
    title: "S278 highway kerbing & footways",
    client: "Galliford Try",
    progress: 88,
    value: 342000,
  },
  {
    id: 4,
    title: "Bulk muck-away & reduced dig",
    client: "Taylor Wimpey",
    progress: 30,
    value: 158000,
  },
  {
    id: 5,
    title: "Foul sewer connection, NRSWA",
    client: "Kier Group",
    progress: 61,
    value: 218400,
  },
  {
    id: 6,
    title: "Sub-base & capping, retail park",
    client: "Wates",
    progress: 15,
    value: 405000,
  },
];

const OVERDUE_INVOICES = [
  { id: "INV-2041", amount: 38200, client: "Persimmon" },
  { id: "INV-2033", amount: 29800, client: "Wates" },
  { id: "INV-2029", amount: 18400, client: "Kier" },
];

const COMPLIANCE_ALERTS = [
  {
    id: 1,
    type: "expired",
    title: "Public Liability — Murphy Plant Hire",
    date: "18 Jun",
  },
  { id: 2, type: "expiring", title: "CSCS card — J. O'Connor", date: "02 Jul" },
  {
    id: 3,
    type: "expiring",
    title: "RAMS — Sewer Connection Plot 9",
    date: "05 Jul",
  },
];

const TODAY_ON_SITE = [
  {
    id: 1,
    site: "Phase 2, Plot 14-22",
    crew: 8,
    plant: 3,
    foreman: "D. Smith",
  },
  {
    id: 2,
    site: "Retail Park Sub-base",
    crew: 5,
    plant: 2,
    foreman: "M. Jones",
  },
];

// Utils
const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(val);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded-lg shadow-sm text-sm min-w-[160px]">
      <div className="font-medium text-[var(--ink)] mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-[var(--muted)]">{p.name}</span>
          </div>
          <span className="font-mono text-[var(--ink)] tnum font-medium">
            £{(p.value / 1000).toFixed(0)}k
          </span>
        </div>
      ))}
    </div>
  );
};

export default function WorldClass() {
  return (
    <div className="gw-root flex h-[1080px] w-[1920px] overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      {/* Navigation Rail */}
      <aside className="w-[240px] flex flex-col border-r border-[var(--border)] bg-[var(--surface)] flex-shrink-0 z-10">
        <div className="h-16 flex items-center px-6 border-b border-[var(--border)]">
          <div className="font-display font-bold text-xl tracking-tight text-[var(--ink)]">
            Groundwork<span className="text-[var(--accent)]">OS</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          <NavItem icon={LayoutDashboard} label="Dashboard" active />
          <NavItem icon={Briefcase} label="Jobs" />
          <NavItem icon={FileText} label="Quotes" />
          <NavItem icon={Receipt} label="Invoices" />
          <NavItem icon={Calendar} label="Schedule" />
          <NavItem icon={Users} label="Clients" />
          <NavItem icon={HardHat} label="Subcontractors" />
          <NavItem icon={FolderOpen} label="Documents" />
          <NavItem icon={Truck} label="Plant" />
          <NavItem icon={BarChart3} label="Reports" />
        </div>

        <div className="p-3 border-t border-[var(--border)]">
          <NavItem icon={Settings} label="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)] tracking-tight">
              Dashboard
            </h1>
            <div className="h-4 w-px bg-[var(--border)]"></div>
            <div className="text-sm text-[var(--muted)] flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4" />
              <span>
                {new Date().toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search jobs, clients, invoices..."
                className="w-64 h-9 pl-9 pr-4 rounded-md border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--muted)] text-[var(--ink)]"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-2)] text-[var(--muted)] bg-[var(--surface)]">
                  ⌘
                </kbd>
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-2)] text-[var(--muted)] bg-[var(--surface)]">
                  K
                </kbd>
              </div>
            </div>

            <button className="relative text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--danger)] rounded-full border border-[var(--surface)]"></span>
            </button>

            <div className="h-8 w-px bg-[var(--border)]"></div>

            <button className="flex items-center gap-3 hover:bg-[var(--surface-2)] p-1.5 pr-3 rounded-md transition-colors border border-transparent hover:border-[var(--border)]">
              <div className="w-8 h-8 rounded bg-[var(--accent)] text-white flex items-center justify-center font-display font-medium text-sm">
                OD
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold leading-tight text-[var(--ink)]">
                  O. Director
                </div>
                <div className="text-xs text-[var(--muted)] leading-tight">
                  Midlands Civil Eng
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label="Pipeline"
                value={2847500}
                subtext="12 active jobs"
              />
              <KpiCard
                label="Collected"
                value={1562300}
                subtext="28 paid invoices"
              />
              <KpiCard
                label="Outstanding"
                value={498750}
                subtext="14 invoices"
              />
              <KpiCard
                label="Overdue"
                value={86400}
                subtext="3 overdue"
                danger
              />
            </div>

            <div className="grid grid-cols-12 gap-6">
              {/* Left Column (Chart + Jobs) */}
              <div className="col-span-8 space-y-6">
                {/* Chart Panel */}
                <Panel
                  title="Revenue vs Collected (6 Mo)"
                  action={
                    <button className="text-sm font-medium text-[var(--accent)] hover:underline flex items-center gap-1">
                      Full Report <ArrowRight className="w-3 h-3" />
                    </button>
                  }
                >
                  <div className="h-[280px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={REVENUE_DATA}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                        barGap={6}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--border)"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "var(--muted)",
                            fontSize: 12,
                            fontFamily: "var(--font-mono)",
                          }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "var(--muted)",
                            fontSize: 12,
                            fontFamily: "var(--font-mono)",
                          }}
                          tickFormatter={(v) => `£${v / 1000}k`}
                          dx={-10}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                        />
                        <Bar
                          dataKey="invoiced"
                          name="Invoiced"
                          fill="var(--surface-3)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="collected"
                          name="Collected"
                          fill="var(--success)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-6 mt-6 pt-4 border-t border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[var(--surface-3)]"></div>
                      <span className="text-sm font-medium text-[var(--muted)]">
                        Invoiced
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[var(--success)]"></div>
                      <span className="text-sm font-medium text-[var(--muted)]">
                        Collected
                      </span>
                    </div>
                  </div>
                </Panel>

                {/* Active Jobs */}
                <Panel
                  title="Active Jobs"
                  action={
                    <button className="text-[var(--muted)] hover:bg-[var(--surface-2)] p-1 rounded transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  }
                  noPad
                >
                  <div className="divide-y divide-[var(--border)]">
                    {ACTIVE_JOBS.map((job) => (
                      <div
                        key={job.id}
                        className="p-4 hover:bg-[var(--surface-2)] transition-colors group cursor-pointer flex items-center gap-6"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-[var(--ink)] truncate">
                              {job.title}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--surface-3)] text-[var(--ink-2)] flex-shrink-0">
                              {job.client}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                            <span className="font-mono tnum">
                              ID: {job.id.toString().padStart(4, "0")}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Site active
                            </span>
                          </div>
                        </div>

                        <div className="w-48 flex-shrink-0">
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-xs font-medium text-[var(--muted)]">
                              Progress
                            </span>
                            <span className="text-xs font-mono font-bold text-[var(--success)]">
                              {job.progress}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--surface-3)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--success)] rounded-full transition-all"
                              style={{ width: `${job.progress}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="w-32 flex-shrink-0 text-right">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-1">
                            Value
                          </div>
                          <div className="font-mono font-medium text-[var(--ink)] tnum">
                            {formatCurrency(job.value)}
                          </div>
                        </div>

                        <div className="flex-shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-2)] rounded-b-xl text-center">
                    <button className="text-sm font-medium text-[var(--ink)] hover:text-[var(--accent)] transition-colors">
                      View all {ACTIVE_JOBS.length} active jobs
                    </button>
                  </div>
                </Panel>
              </div>

              {/* Right Column (Alerts + Today) */}
              <div className="col-span-4 space-y-6">
                {/* Alerts Panel */}
                <Panel
                  title="Action Required"
                  badge={OVERDUE_INVOICES.length + COMPLIANCE_ALERTS.length}
                >
                  <div className="space-y-6">
                    {/* Overdue */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-[var(--danger)]" />
                        Overdue Invoices
                      </h4>
                      <div className="space-y-2">
                        {OVERDUE_INVOICES.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between p-3 rounded-md bg-[var(--surface-2)] border border-[var(--danger)]/20 hover:border-[var(--danger)]/40 transition-colors cursor-pointer group"
                          >
                            <div>
                              <div className="font-mono font-bold text-sm text-[var(--danger)]">
                                {inv.id}
                              </div>
                              <div className="text-xs text-[var(--muted)] mt-0.5">
                                {inv.client}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-sm text-[var(--ink)] tnum">
                                {formatCurrency(inv.amount)}
                              </div>
                              <div className="text-[10px] font-medium text-[var(--danger)] mt-0.5 flex items-center justify-end gap-1">
                                <ArrowRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 transition-all" />
                                Review
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-px w-full bg-[var(--border)]"></div>

                    {/* Compliance */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3 flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-[var(--warning)]" />
                        Compliance Lapsing
                      </h4>
                      <div className="space-y-2">
                        {COMPLIANCE_ALERTS.map((alert) => (
                          <div
                            key={alert.id}
                            className="flex items-start gap-3 p-3 rounded-md border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer group"
                          >
                            <div
                              className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${alert.type === "expired" ? "bg-[var(--danger)]" : "bg-[var(--warning)]"}`}
                            ></div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[var(--ink)] leading-tight group-hover:text-[var(--accent)] transition-colors">
                                {alert.title}
                              </div>
                              <div className="text-xs font-mono text-[var(--muted)] mt-1.5 flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                <span
                                  className={
                                    alert.type === "expired"
                                      ? "text-[var(--danger)]"
                                      : "text-[var(--warning)]"
                                  }
                                >
                                  {alert.type === "expired"
                                    ? "Expired"
                                    : "Expiring"}{" "}
                                  {alert.date}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Panel>

                {/* Today On Site (Glanceable Element) */}
                <Panel
                  title="Today On Site"
                  action={
                    <button className="text-[var(--accent)] hover:underline text-sm font-medium">
                      Map
                    </button>
                  }
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-md bg-[var(--surface-2)]">
                      <div className="text-sm font-medium text-[var(--ink)]">
                        Total Active Crews
                      </div>
                      <div className="font-mono font-bold text-lg text-[var(--accent)]">
                        13
                      </div>
                    </div>
                    {TODAY_ON_SITE.map((site) => (
                      <div
                        key={site.id}
                        className="p-3 border border-[var(--border)] rounded-md hover:border-[var(--accent)]/50 transition-colors cursor-pointer"
                      >
                        <div className="font-semibold text-sm text-[var(--ink)] mb-2">
                          {site.site}
                        </div>
                        <div className="flex justify-between text-xs text-[var(--muted)]">
                          <span className="flex items-center gap-1">
                            <HardHat className="w-3.5 h-3.5" /> {site.crew} men
                          </span>
                          <span className="flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5" /> {site.plant} plant
                          </span>
                          <span className="font-medium text-[var(--ink-2)]">
                            {site.foreman}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponents

function NavItem({
  icon: Icon,
  label,
  active = false,
}: {
  icon: any;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm transition-all
      ${
        active
          ? "bg-[var(--accent-bg)] text-[var(--accent)]"
          : "text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      }
    `}
    >
      <Icon
        className={`w-4 h-4 ${active ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
        strokeWidth={active ? 2.5 : 2}
      />
      {label}
    </button>
  );
}

function KpiCard({
  label,
  value,
  subtext,
  danger = false,
}: {
  label: string;
  value: number;
  subtext: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`bg-[var(--surface)] border ${danger ? "border-[var(--danger)]/30 shadow-[0_2px_10px_rgba(193,58,42,0.05)]" : "border-[var(--border)] shadow-sm"} rounded-xl p-5 flex flex-col relative overflow-hidden`}
    >
      {danger && (
        <div className="absolute top-0 left-0 w-full h-1 bg-[var(--danger)]"></div>
      )}
      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
        {label}
      </h3>
      <div
        className={`font-mono text-3xl font-bold tracking-tight mb-2 tnum ${danger ? "text-[var(--danger)]" : "text-[var(--ink)]"}`}
      >
        {formatCurrency(value)}
      </div>
      <p
        className={`text-sm font-medium ${danger ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}
      >
        {subtext}
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
  action,
  badge,
  noPad = false,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  badge?: number;
  noPad?: boolean;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-semibold text-lg text-[var(--ink)]">
            {title}
          </h2>
          {badge !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] font-mono text-xs font-bold">
              {badge}
            </span>
          )}
        </div>
        {action}
      </div>
      <div className={`flex-1 ${noPad ? "" : "p-5"}`}>{children}</div>
    </div>
  );
}
