import {
  Briefcase,
  Users,
  FolderOpen,
  Truck,
  Search,
  Bell,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  MapPin,
  Wrench,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./_group.css";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(v);

const NAV = [
  "Dashboard",
  "Jobs",
  "Schedule",
  "Quotes",
  "Invoices",
  "Clients",
  "Subcontractors",
  "Documents",
  "Plant",
  "Reports",
];

const SITE_LOG = [
  {
    no: "01",
    site: "Plot 14-22, Wickford",
    client: "Barratt Homes",
    ref: "JB-2041",
    crew: 8,
    plant: 3,
    foreman: "D. Smith",
    pct: 72,
  },
  {
    no: "02",
    site: "Chelmsford Road",
    client: "Persimmon",
    ref: "JB-2038",
    crew: 6,
    plant: 2,
    foreman: "M. Jones",
    pct: 45,
  },
  {
    no: "03",
    site: "A414 Interchange",
    client: "Galliford Try",
    ref: "JB-2035",
    crew: 11,
    plant: 4,
    foreman: "R. Ahmed",
    pct: 88,
  },
  {
    no: "04",
    site: "Brentwood North",
    client: "Taylor Wimpey",
    ref: "JB-2029",
    crew: 5,
    plant: 1,
    foreman: "J. O'Connor",
    pct: 30,
  },
];

const FLAGS = [
  {
    kind: "danger",
    label: "INV-2041 overdue",
    detail: "Persimmon · £38,200 · 14 days",
    icon: AlertTriangle,
  },
  {
    kind: "danger",
    label: "INV-2033 overdue",
    detail: "Wates · £29,800 · 6 days",
    icon: AlertTriangle,
  },
  {
    kind: "warning",
    label: "Public Liability expired",
    detail: "Murphy Plant Hire · 18 Jun",
    icon: ShieldAlert,
  },
  {
    kind: "warning",
    label: "CSCS card expiring",
    detail: "J. O'Connor · 02 Jul",
    icon: ShieldAlert,
  },
  {
    kind: "warning",
    label: "RAMS expiring",
    detail: "Sewer Connection Plot 9 · 05 Jul",
    icon: Wrench,
  },
];

const REVENUE = [
  { month: "Jan", collected: 280000 },
  { month: "Feb", collected: 331000 },
  { month: "Mar", collected: 377000 },
  { month: "Apr", collected: 362000 },
  { month: "May", collected: 410000 },
  { month: "Jun", collected: 295000 },
];

const FLAG_COLOR: Record<string, string> = {
  danger: "#c13a2a",
  warning: "#b56918",
};

function DatumHeader({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "#1b5e78",
          fontWeight: 600,
        }}
      >
        {n}
      </span>
      <h2
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "#1b5e78",
        }}
      >
        {label}
      </h2>
      <div className="flex-1" style={{ borderBottom: "1px solid #d9d4ce" }} />
    </div>
  );
}

export default function Fieldbook() {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="gw-root h-[1080px] w-[1920px] overflow-hidden flex flex-col"
      style={{
        backgroundColor: "#f0ede8",
        color: "#181410",
        backgroundImage: "linear-gradient(#e3ddd4 1px, transparent 1px)",
        backgroundSize: "100% 42px",
      }}
    >
      <header
        className="h-16 flex items-center justify-between px-10 flex-shrink-0"
        style={{
          backgroundColor: "#fafaf8",
          borderBottom: "2px solid #1b5e78",
        }}
      >
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 flex items-center justify-center"
              style={{ border: "1.5px solid #1b5e78", borderRadius: 4 }}
            >
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#1b5e78",
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
                letterSpacing: "0.06em",
              }}
            >
              GROUNDWORK<span style={{ color: "#1b5e78" }}>OS</span>
            </span>
          </div>
          <nav className="flex items-center gap-6">
            {NAV.map((n, i) => (
              <span
                key={n}
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: "0.02em",
                  color: i === 0 ? "#1b5e78" : "#7a7469",
                  borderBottom:
                    i === 0 ? "2px solid #1b5e78" : "2px solid transparent",
                  paddingBottom: 21,
                  marginBottom: -21,
                }}
              >
                {n}
              </span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Search className="w-4 h-4" style={{ color: "#7a7469" }} />
          <div className="relative">
            <Bell className="w-4 h-4" style={{ color: "#c13a2a" }} />
            <span
              className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#c13a2a" }}
            />
          </div>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{
              backgroundColor: "#1b5e78",
              color: "#fff",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            DS
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-10 py-8">
        <div className="max-w-[1500px] mx-auto">
          <div
            className="flex items-end justify-between mb-8 pb-6"
            style={{ borderBottom: "3px double #1b5e78" }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "#7a7469",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                SITE DIARY · ENTRY 06-07-26
              </div>
              <h1
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 34,
                  letterSpacing: "-0.01em",
                }}
              >
                {today}
              </h1>
            </div>
            <div className="flex items-center gap-8">
              {[
                { label: "Pipeline", value: fmt(2870000) },
                { label: "Collected MTD", value: fmt(295000) },
                { label: "Overdue", value: fmt(68000), danger: true },
              ].map((s) => (
                <div key={s.label} className="text-right">
                  <div
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 600,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#7a7469",
                      marginBottom: 4,
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="tnum"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      fontSize: 22,
                      color: s.danger ? "#c13a2a" : "#181410",
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-10">
            <div className="col-span-2">
              <DatumHeader n="01" label="Sites Active Today" />
              <div className="space-y-0 mb-10">
                {SITE_LOG.map((s) => (
                  <div
                    key={s.ref}
                    className="flex items-center gap-5 py-4"
                    style={{ borderBottom: "1px solid #d9d4ce" }}
                  >
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#d9d4ce",
                        width: 36,
                      }}
                    >
                      {s.no}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2.5">
                        <span
                          style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontWeight: 600,
                            fontSize: 15,
                          }}
                        >
                          {s.site}
                        </span>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            color: "#7a7469",
                          }}
                        >
                          {s.ref}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-3 mt-1 text-xs"
                        style={{ color: "#7a7469" }}
                      >
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {s.client}
                        </span>
                        <span>
                          · Crew {s.crew} · Plant {s.plant} · Foreman{" "}
                          {s.foreman}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2 flex-shrink-0"
                      style={{ width: 160 }}
                    >
                      <div
                        className="flex-1 h-1 rounded-full overflow-hidden"
                        style={{ backgroundColor: "#e8e4dd" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${s.pct}%`,
                            backgroundColor: "#2a6e45",
                          }}
                        />
                      </div>
                      <span
                        className="tnum"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#2a6e45",
                        }}
                      >
                        {s.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <DatumHeader n="02" label="Collected — Last 6 Months" />
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={REVENUE}
                    barCategoryGap="40%"
                    margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="month"
                      tick={{
                        fill: "#7a7469",
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                      axisLine={{ stroke: "#d9d4ce" }}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "#eeeae4" }}
                      content={({ active, payload, label }: any) =>
                        active && payload?.length ? (
                          <div
                            className="px-2.5 py-2 rounded text-xs"
                            style={{
                              backgroundColor: "#fafaf8",
                              border: "1px solid #d9d4ce",
                            }}
                          >
                            <span style={{ color: "#7a7469" }}>{label}: </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontWeight: 700,
                              }}
                            >
                              {fmt(payload[0].value)}
                            </span>
                          </div>
                        ) : null
                      }
                    />
                    <Bar
                      dataKey="collected"
                      fill="#1b5e78"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={56}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <DatumHeader n="03" label="Flagged Items" />
              <div className="space-y-3">
                {FLAGS.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded"
                    style={{
                      backgroundColor: "#fafaf8",
                      borderLeft: `3px solid ${FLAG_COLOR[f.kind]}`,
                    }}
                  >
                    <f.icon
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: FLAG_COLOR[f.kind] }}
                    />
                    <div className="min-w-0">
                      <div
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {f.label}
                      </div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: "#7a7469" }}
                      >
                        {f.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-8 p-4 rounded"
                style={{ backgroundColor: "#e8f3f7" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#1b5e78",
                    }}
                  >
                    Fleet Snapshot
                  </span>
                  <ArrowUpRight
                    className="w-3.5 h-3.5"
                    style={{ color: "#1b5e78" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Truck, label: "Plant on site", value: 10 },
                    { icon: Users, label: "Crew deployed", value: 30 },
                    { icon: Briefcase, label: "Quotes pending", value: 6 },
                    { icon: FolderOpen, label: "Doc alerts", value: 3 },
                  ].map((f) => (
                    <div key={f.label}>
                      <f.icon
                        className="w-3.5 h-3.5 mb-1"
                        style={{ color: "#1b5e78" }}
                      />
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          fontSize: 18,
                        }}
                      >
                        {f.value}
                      </div>
                      <div style={{ fontSize: 10, color: "#4a4540" }}>
                        {f.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
