import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { Panel } from "../../components/ui/Panel";
import { StatCard } from "../../components/ui/StatCard";
import { formatCurrency } from "../../lib/utils";
import { CustomTooltip } from "./CustomTooltip";
import { GREEN, YELLOW, ORANGE, RED, TYPE_COLORS } from "./types";
import type { ReportsOverviewData } from "./useReportsData";

/**
 * Purely presentational: every number here comes from `data`
 * (useReportsData.ts) or `props` - no derivation happens in this component.
 * See ReportsPage.tsx's header comment for the data-hook/presentational
 * split this tab (and its siblings in this directory) follows.
 */
export function OverviewTab({ data }: { data: ReportsOverviewData }) {
  const {
    totalRevenue,
    totalOutstanding,
    unpaidCount,
    overdueTotal,
    overdueInvoices,
    paidInvoices,
    collectionRate,
    revenueData,
    cumulativeData,
    pipelineByStatus,
    jobTypeData,
    agingBuckets,
    totalPipeline,
  } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          accent
          label="Revenue Collected"
          value={formatCurrency(totalRevenue)}
          sub={`${paidInvoices.length} paid`}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(totalOutstanding)}
          sub={`${unpaidCount} unpaid`}
        />
        <StatCard
          danger={overdueTotal > 0}
          label="Overdue"
          value={formatCurrency(overdueTotal)}
          sub={`${overdueInvoices.length} invoices`}
        />
        <StatCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          sub="of total invoiced"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Panel title="Revenue vs Invoiced — Last 6 Months">
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
                    stroke="var(--surface-3)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{
                      fill: "var(--muted)",
                      fontSize: 11,
                      fontFamily: "var(--font-body)",
                    }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    tick={{
                      fill: "var(--muted)",
                      fontSize: 10,
                      fontFamily: "var(--font-body)",
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
                    cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
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
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--muted)" }}
              >
                <span
                  className="w-3 h-3 inline-block"
                  style={{ backgroundColor: "#e0dbd5" }}
                />{" "}
                Invoiced
              </div>
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--muted)" }}
              >
                <span
                  className="w-3 h-3 inline-block"
                  style={{ backgroundColor: "#2a6e45" }}
                />{" "}
                Collected
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Jobs by Type">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={jobTypeData}
                  cx="50%"
                  cy="45%"
                  outerRadius={75}
                  innerRadius={45}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                >
                  {jobTypeData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={TYPE_COLORS[i % TYPE_COLORS.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
            {jobTypeData.map((d, i) => (
              <div
                key={d.name}
                className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-medium"
              >
                <span
                  className="w-2 h-2 flex-shrink-0"
                  style={{
                    backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length],
                  }}
                />
                <span style={{ color: "var(--muted)" }}>
                  {d.name}{" "}
                  <span
                    className="font-mono ml-0.5"
                    style={{ color: "var(--ink)" }}
                  >
                    ({d.value})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Cumulative Revenue">
          <div style={{ height: 200 }} className="mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={cumulativeData}
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GREEN} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--surface-3)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="month"
                  tick={{
                    fill: "var(--muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-body)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{
                    fill: "var(--muted)",
                    fontSize: 10,
                    fontFamily: "var(--font-body)",
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
                  cursor={{ stroke: "#c0bab4", strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative"
                  stroke={GREEN}
                  strokeWidth={2}
                  fill="url(#revGrad)"
                  dot={{
                    fill: GREEN,
                    r: 3,
                    strokeWidth: 2,
                    stroke: "var(--surface)",
                  }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Aged Debtors">
          <div style={{ height: 200 }} className="mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agingBuckets}
                barCategoryGap="30%"
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--surface-3)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tick={{
                    fill: "var(--muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-body)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{
                    fill: "var(--muted)",
                    fontSize: 10,
                    fontFamily: "var(--font-body)",
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
                  cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                />
                <Bar
                  dataKey="value"
                  name="Outstanding"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                >
                  {agingBuckets.map((_, i) => (
                    <Cell key={i} fill={[GREEN, YELLOW, ORANGE, RED][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            className="grid grid-cols-4 gap-2 mt-5 pt-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {agingBuckets.map((b, i) => (
              <div key={b.label} className="text-center">
                <div
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--muted)" }}
                >
                  {b.label}
                </div>
                <div
                  className="text-sm font-mono tnum mt-1"
                  style={{ color: [GREEN, YELLOW, ORANGE, RED][i] }}
                >
                  {b.count > 0 ? formatCurrency(b.value) : "—"}
                </div>
                <div
                  className="text-[10px] mt-0.5"
                  style={{ color: "var(--muted)" }}
                >
                  {b.count > 0 ? `${b.count} inv` : ""}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Pipeline by Status">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {pipelineByStatus.map(({ label, color, count, value }) => {
            const pct =
              totalPipeline > 0 ? Math.round((value / totalPipeline) * 100) : 0;
            return (
              <div
                key={label}
                className="p-4 "
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-2 h-2 "
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{
                      color: "var(--muted)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {label}
                  </span>
                </div>
                <div
                  className="text-2xl font-bold mb-1 font-mono tnum"
                  style={{ color }}
                >
                  {formatCurrency(value)}
                </div>
                <div
                  className="text-xs mb-3 font-mono"
                  style={{ color: "var(--muted)" }}
                >
                  {count} jobs · {pct}% of pipeline
                </div>
                <div
                  className="h-1.5 overflow-hidden"
                  style={{ backgroundColor: "var(--surface-2)" }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
