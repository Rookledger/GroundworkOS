import { useState } from "react";
import { Download, ChevronRight, FileDown } from "lucide-react";
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
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Btn } from "../components/ui/Btn";
import { formatCurrency } from "../lib/utils";
import { useApp } from "../store/AppContext";

type ReportTab = "overview" | "pl" | "cis" | "ratebook";

const YELLOW = "#1b5e78";
const RED = "#c13a2a";
const GREEN = "#2a6e45";
const ORANGE = "#b56918";
const BLUE = "#1b5e78";

function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
            {typeof p.value === "number" && p.value > 100
              ? formatCurrency(p.value)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function ReportsPage() {
  const { state } = useApp();
  const { invoices, jobs, cisReturns, rateBook, timesheets, purchaseOrders } =
    state;

  const [tab, setTab] = useState<ReportTab>("overview");
  const [rateCategory, setRateCategory] = useState("all");

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalRevenue = paidInvoices.reduce((s, i) => s + i.total_amount, 0);
  const totalOutstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "credited")
    .reduce((s, i) => s + i.total_amount, 0);
  const totalPipeline = jobs
    .filter((j) => j.status !== "cancelled")
    .reduce((s, j) => s + (j.value ?? 0), 0);
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.total_amount, 0);

  const monthMap = new Map<
    string,
    { invoiced: number; collected: number; month: string }
  >();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, {
      invoiced: 0,
      collected: 0,
      month: d.toLocaleDateString("en-GB", { month: "short" }),
    });
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

  let cumulative = 0;
  const cumulativeData = revenueData.map((d) => {
    cumulative += d.collected;
    return { ...d, cumulative };
  });

  const pipelineByStatus = [
    { label: "Active", status: "active", color: GREEN },
    { label: "Quoted", status: "quoted", color: YELLOW },
    { label: "Complete", status: "complete", color: BLUE },
    { label: "On Hold", status: "on_hold", color: ORANGE },
  ].map(({ label, status, color }) => {
    const pJobs = jobs.filter((j) => j.status === status);
    return {
      label,
      color,
      count: pJobs.length,
      value: pJobs.reduce((s, j) => s + (j.value ?? 0), 0),
    };
  });

  const jobTypeData = Object.entries(
    jobs.reduce(
      (acc, j) => {
        if (!j.type) return acc;
        acc[j.type] = (acc[j.type] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  )
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

  const TYPE_COLORS = [
    "#1b5e78",
    "#b56918",
    "#2a6e45",
    "#4a4540",
    "#7a7469",
    "#d9d4ce",
    "#c13a2a",
    "#e8e4dd",
  ];

  const agingBuckets = [
    {
      label: "0–30 days",
      invoices: invoices.filter(
        (i) =>
          (i.status === "sent" || i.status === "overdue") &&
          daysOld(i.due_date) <= 30,
      ),
    },
    {
      label: "31–60 days",
      invoices: invoices.filter(
        (i) =>
          (i.status === "sent" || i.status === "overdue") &&
          daysOld(i.due_date) > 30 &&
          daysOld(i.due_date) <= 60,
      ),
    },
    {
      label: "61–90 days",
      invoices: invoices.filter(
        (i) =>
          (i.status === "sent" || i.status === "overdue") &&
          daysOld(i.due_date) > 60 &&
          daysOld(i.due_date) <= 90,
      ),
    },
    {
      label: "90+ days",
      invoices: invoices.filter(
        (i) =>
          (i.status === "sent" || i.status === "overdue") &&
          daysOld(i.due_date) > 90,
      ),
    },
  ].map((b) => ({
    label: b.label,
    value: b.invoices.reduce((s, i) => s + i.total_amount, 0),
    count: b.invoices.length,
  }));

  const cisPending = cisReturns.filter((r) => !r.submitted);
  const cisTotalDeductions = cisReturns
    .filter((r) => r.submitted)
    .reduce((s, r) => s + r.deduction_amount, 0);
  const rateCategories = [
    "all",
    ...Array.from(new Set(rateBook.map((r: any) => r.category))),
  ];
  const filteredRates = rateBook.filter(
    (r: any) => rateCategory === "all" || r.category === rateCategory,
  );
  const taxMonths = [...new Set(cisReturns.map((r) => r.tax_month))]
    .sort()
    .reverse();

  const collectionRate =
    totalRevenue + totalOutstanding > 0
      ? Math.round((totalRevenue / (totalRevenue + totalOutstanding)) * 100)
      : 0;

  function exportCurrentTab() {
    if (tab === "overview") {
      downloadCSV(
        "revenue-summary.csv",
        ["Month", "Invoiced (£)", "Collected (£)", "Cumulative (£)"],
        cumulativeData.map((d) => [
          d.month,
          d.invoiced.toFixed(2),
          d.collected.toFixed(2),
          d.cumulative.toFixed(2),
        ]),
      );
    } else if (tab === "pl") {
      const activeJobs = jobs.filter((j) => j.status !== "cancelled");
      const rows = activeJobs.map((j) => {
        const jobInvoices = invoices.filter((i) => i.job_id === j.id);
        const invoiced = jobInvoices.reduce((s, i) => s + i.total_amount, 0);
        const collected = jobInvoices
          .filter((i) => i.status === "paid")
          .reduce((s, i) => s + i.total_amount, 0);
        const labour = timesheets
          .filter((t) => t.job_id === j.id)
          .reduce((s, t) => s + (t.cost ?? 0), 0);
        const materials = purchaseOrders
          .filter((o) => o.job_id === j.id)
          .reduce((s, o) => s + o.total_amount, 0);
        const totalCost = labour + materials;
        const contractValue = j.value ?? 0;
        const margin =
          contractValue > 0
            ? ((contractValue - totalCost) / contractValue) * 100
            : 0;
        return [
          j.job_number ?? "",
          j.title,
          j.status,
          contractValue.toFixed(2),
          invoiced.toFixed(2),
          collected.toFixed(2),
          labour.toFixed(2),
          materials.toFixed(2),
          totalCost.toFixed(2),
          margin.toFixed(1),
        ];
      });
      downloadCSV(
        `job-pl-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Job Number",
          "Title",
          "Status",
          "Contract Value (£)",
          "Invoiced (£)",
          "Collected (£)",
          "Labour Cost (£)",
          "Materials Cost (£)",
          "Total Cost (£)",
          "Margin (%)",
        ],
        rows,
      );
    } else if (tab === "cis") {
      exportCIS300(cisReturns, "cis300-all.csv");
    } else if (tab === "ratebook") {
      downloadCSV(
        `rate-book-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Category",
          "Description",
          "Unit",
          "Labour Rate (£)",
          "Material Rate (£)",
          "Plant Rate (£)",
          "Total Rate (£)",
          "Notes",
        ],
        (rateBook as any[]).map((r) => [
          r.category,
          r.description,
          r.unit,
          r.labour_rate.toFixed(2),
          r.material_rate.toFixed(2),
          r.plant_rate.toFixed(2),
          r.total_rate.toFixed(2),
          r.notes ?? "",
        ]),
      );
    }
  }

  function exportCIS300(returns: typeof cisReturns, filename: string) {
    downloadCSV(
      filename,
      [
        "Tax Month",
        "Subcontractor Name",
        "UTR Number",
        "Gross Payment (£)",
        "CIS Tax Deducted (£)",
        "Net Payment (£)",
        "Deduction Rate (%)",
        "Submitted",
      ],
      returns.map((r) => [
        r.tax_month,
        r.subcontractor_name,
        r.utr ?? "",
        r.gross_payment.toFixed(2),
        r.deduction_amount.toFixed(2),
        r.net_payment.toFixed(2),
        r.deduction_rate,
        r.submitted ? "Yes" : "No",
      ]),
    );
  }

  const exportLabel: Record<ReportTab, string> = {
    overview: "Revenue CSV",
    pl: "P&L CSV",
    cis: "CIS300 CSV",
    ratebook: "Rate Book CSV",
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{
              color: "#181410",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Reports
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#7a7469" }}>
            Financial reports, CIS returns & rate book
          </p>
        </div>
        <Btn variant="outline" size="sm" onClick={exportCurrentTab}>
          <Download className="w-3.5 h-3.5" /> Export {exportLabel[tab]}
        </Btn>
      </div>

      <div
        className="flex items-center gap-1"
        style={{ borderBottom: "1px solid #d9d4ce" }}
      >
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "pl", label: "Job P&L" },
            { id: "cis", label: "CIS Return" },
            { id: "ratebook", label: "Rate Book" },
          ] as { id: ReportTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm transition-colors"
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

      {tab === "overview" && (
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
              sub={`${invoices.filter((i) => i.status === "sent" || i.status === "overdue").length} unpaid`}
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
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length],
                      }}
                    />
                    <span style={{ color: "#7a7469" }}>
                      {d.name}{" "}
                      <span
                        className="font-mono ml-0.5"
                        style={{ color: "#181410" }}
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
                        stroke: "#fafaf8",
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
                      stroke="#e8e4dd"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="label"
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
                style={{ borderTop: "1px solid #d9d4ce" }}
              >
                {agingBuckets.map((b, i) => (
                  <div key={b.label} className="text-center">
                    <div
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "#7a7469" }}
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
                      style={{ color: "#7a7469" }}
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
                  totalPipeline > 0
                    ? Math.round((value / totalPipeline) * 100)
                    : 0;
                return (
                  <div
                    key={label}
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "#fafaf8",
                      border: "1px solid #d9d4ce",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span
                        className="text-[11px] font-bold uppercase tracking-widest"
                        style={{
                          color: "#7a7469",
                          fontFamily: "'Space Grotesk', sans-serif",
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
                      style={{ color: "#7a7469" }}
                    >
                      {count} jobs · {pct}% of pipeline
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: "#eeeae4" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {tab === "pl" &&
        (() => {
          const activeJobs = jobs.filter((j) => j.status !== "cancelled");

          const jobRows = activeJobs
            .map((j) => {
              const jobInvoices = invoices.filter((i) => i.job_id === j.id);
              const invoiced = jobInvoices.reduce(
                (s, i) => s + i.total_amount,
                0,
              );
              const collected = jobInvoices
                .filter((i) => i.status === "paid")
                .reduce((s, i) => s + i.total_amount, 0);
              const labour = timesheets
                .filter((t) => t.job_id === j.id)
                .reduce((s, t) => s + (t.cost ?? 0), 0);
              const materials = purchaseOrders
                .filter((o) => o.job_id === j.id)
                .reduce((s, o) => s + o.total_amount, 0);
              const totalCost = labour + materials;
              const contractValue = j.value ?? 0;
              const margin =
                contractValue > 0
                  ? ((contractValue - totalCost) / contractValue) * 100
                  : null;
              const marginOnInvoiced =
                invoiced > 0 ? ((invoiced - totalCost) / invoiced) * 100 : null;
              return {
                job: j,
                invoiced,
                collected,
                labour,
                materials,
                totalCost,
                contractValue,
                margin,
                marginOnInvoiced,
              };
            })
            .sort((a, b) => b.contractValue - a.contractValue);

          const totalContractValue = jobRows.reduce(
            (s, r) => s + r.contractValue,
            0,
          );
          const totalLabour = jobRows.reduce((s, r) => s + r.labour, 0);
          const totalMaterials = jobRows.reduce((s, r) => s + r.materials, 0);
          const totalCost = totalLabour + totalMaterials;
          const overallMargin =
            totalContractValue > 0
              ? ((totalContractValue - totalCost) / totalContractValue) * 100
              : 0;

          const plChartData = jobRows.slice(0, 8).map((r) => ({
            name: r.job.job_number ?? r.job.title.slice(0, 12),
            Revenue: r.invoiced,
            Labour: r.labour,
            Materials: r.materials,
          }));

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  accent
                  label="Total Contract Value"
                  value={formatCurrency(totalContractValue)}
                  sub={`${activeJobs.length} active jobs`}
                />
                <StatCard
                  label="Labour Cost"
                  value={formatCurrency(totalLabour)}
                  sub={`${timesheets.length} timesheet entries`}
                />
                <StatCard
                  label="Materials Cost"
                  value={formatCurrency(totalMaterials)}
                  sub={`${purchaseOrders.length} purchase orders`}
                />
                <StatCard
                  accent={overallMargin > 20}
                  danger={overallMargin < 0}
                  label="Overall Margin"
                  value={`${overallMargin.toFixed(1)}%`}
                  sub="contract vs total cost"
                />
              </div>

              {plChartData.length > 0 && (
                <Panel title="Revenue vs Cost by Job (top 8)">
                  <div style={{ height: 260 }} className="mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={plChartData}
                        barGap={4}
                        barCategoryGap="25%"
                        margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          vertical={false}
                          stroke="#e8e4dd"
                          strokeDasharray="3 3"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: "#7a7469",
                            fontSize: 10,
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
                          width={42}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          cursor={{ fill: "#eeeae4", opacity: 0.5 }}
                        />
                        <Bar
                          dataKey="Revenue"
                          fill="#1b5e78"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={36}
                        />
                        <Bar
                          dataKey="Labour"
                          fill="#b56918"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={36}
                        />
                        <Bar
                          dataKey="Materials"
                          fill="#4a4540"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={36}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div
                    className="flex items-center gap-6 mt-4 pt-4"
                    style={{ borderTop: "1px solid #d9d4ce" }}
                  >
                    {[
                      ["#1b5e78", "Revenue"],
                      ["#b56918", "Labour"],
                      ["#4a4540", "Materials"],
                    ].map(([color, label]) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 text-xs"
                        style={{ color: "#7a7469" }}
                      >
                        <span
                          className="w-3 h-3 rounded-sm inline-block"
                          style={{ backgroundColor: color }}
                        />{" "}
                        {label}
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              <Panel noPad title="Job-by-Job Breakdown">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid #d9d4ce",
                          backgroundColor: "#fafaf8",
                        }}
                      >
                        {[
                          "Job",
                          "Status",
                          "Contract Value",
                          "Invoiced",
                          "Labour",
                          "Materials",
                          "Total Cost",
                          "Margin",
                        ].map((h) => (
                          <th
                            key={h}
                            className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: "#7a7469" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jobRows.map((r, i) => {
                        const margin = r.margin;
                        const marginColor =
                          margin === null
                            ? "#a8a099"
                            : margin >= 20
                              ? GREEN
                              : margin >= 0
                                ? ORANGE
                                : RED;
                        return (
                          <tr
                            key={r.job.id}
                            className="transition-colors hover:bg-[#eeeae4]"
                            style={{
                              borderBottom:
                                i < jobRows.length - 1
                                  ? "1px solid #e8e4dd"
                                  : "none",
                            }}
                          >
                            <td className="py-3 px-4">
                              <div
                                className="text-sm font-mono font-semibold"
                                style={{ color: "#1b5e78" }}
                              >
                                {r.job.job_number}
                              </div>
                              <div
                                className="text-xs mt-0.5 max-w-[180px] truncate"
                                style={{ color: "#7a7469" }}
                              >
                                {r.job.title}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                                style={{
                                  backgroundColor:
                                    r.job.status === "active"
                                      ? "rgba(42,110,69,0.1)"
                                      : r.job.status === "complete"
                                        ? "#e8f3f7"
                                        : "#eeeae4",
                                  color:
                                    r.job.status === "active"
                                      ? GREEN
                                      : r.job.status === "complete"
                                        ? "#1b5e78"
                                        : "#7a7469",
                                }}
                              >
                                {r.job.status}
                              </span>
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum font-semibold"
                              style={{ color: "#181410" }}
                            >
                              {r.contractValue > 0
                                ? formatCurrency(r.contractValue)
                                : "—"}
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum"
                              style={{ color: "#4a4540" }}
                            >
                              {r.invoiced > 0
                                ? formatCurrency(r.invoiced)
                                : "—"}
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum"
                              style={{
                                color: r.labour > 0 ? "#b56918" : "#d9d4ce",
                              }}
                            >
                              {r.labour > 0 ? formatCurrency(r.labour) : "—"}
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum"
                              style={{
                                color: r.materials > 0 ? "#4a4540" : "#d9d4ce",
                              }}
                            >
                              {r.materials > 0
                                ? formatCurrency(r.materials)
                                : "—"}
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum font-semibold"
                              style={{ color: "#181410" }}
                            >
                              {r.totalCost > 0
                                ? formatCurrency(r.totalCost)
                                : "—"}
                            </td>
                            <td className="py-3 px-4">
                              {margin !== null ? (
                                <div>
                                  <div
                                    className="text-sm font-mono font-bold tnum"
                                    style={{ color: marginColor }}
                                  >
                                    {margin.toFixed(1)}%
                                  </div>
                                  <div
                                    className="h-1 rounded-full mt-1.5 overflow-hidden"
                                    style={{
                                      width: 60,
                                      backgroundColor: "#e8e4dd",
                                    }}
                                  >
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.min(100, Math.max(0, margin))}%`,
                                        backgroundColor: marginColor,
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: "#d9d4ce" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          borderTop: "2px solid #d9d4ce",
                          backgroundColor: "#fafaf8",
                        }}
                      >
                        <td
                          colSpan={2}
                          className="py-3 px-4 text-xs font-bold uppercase tracking-widest"
                          style={{ color: "#7a7469" }}
                        >
                          Totals
                        </td>
                        <td
                          className="py-3 px-4 text-sm font-mono font-bold tnum"
                          style={{ color: "#181410" }}
                        >
                          {formatCurrency(totalContractValue)}
                        </td>
                        <td
                          className="py-3 px-4 text-sm font-mono tnum"
                          style={{ color: "#4a4540" }}
                        >
                          {formatCurrency(
                            jobRows.reduce((s, r) => s + r.invoiced, 0),
                          )}
                        </td>
                        <td
                          className="py-3 px-4 text-sm font-mono tnum font-bold"
                          style={{ color: "#b56918" }}
                        >
                          {formatCurrency(totalLabour)}
                        </td>
                        <td
                          className="py-3 px-4 text-sm font-mono tnum font-bold"
                          style={{ color: "#4a4540" }}
                        >
                          {formatCurrency(totalMaterials)}
                        </td>
                        <td
                          className="py-3 px-4 text-sm font-mono tnum font-bold"
                          style={{ color: "#181410" }}
                        >
                          {formatCurrency(totalCost)}
                        </td>
                        <td
                          className="py-3 px-4 text-sm font-mono font-bold tnum"
                          style={{
                            color:
                              overallMargin >= 20
                                ? GREEN
                                : overallMargin >= 0
                                  ? ORANGE
                                  : RED,
                          }}
                        >
                          {overallMargin.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Panel>
            </div>
          );
        })()}

      {tab === "cis" && (
        <div className="space-y-6">
          <div
            className="flex items-start gap-3 p-4 rounded-lg"
            style={{
              backgroundColor: "#e8f3f7",
              border: "1px solid rgba(27,94,120,0.2)",
            }}
          >
            <div className="flex-1">
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "#1b5e78" }}
              >
                Construction Industry Scheme (CIS)
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#4a4540" }}
              >
                Monthly returns must be filed with HMRC by the 19th of the
                following tax month. Deductions must be made from subcontractors
                verified as "net" or "unverified".
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Deductions Filed"
              value={formatCurrency(cisTotalDeductions)}
            />
            <StatCard label="Pending Submission" value={cisPending.length} />
            <StatCard
              danger={cisPending.length > 0}
              label="Pending Deductions"
              value={formatCurrency(
                cisPending.reduce((s, r) => s + r.deduction_amount, 0),
              )}
            />
          </div>

          <div className="space-y-6">
            {taxMonths.map((month) => {
              const monthReturns = cisReturns.filter(
                (r) => r.tax_month === month,
              );
              if (monthReturns.length === 0) return null;
              const submitted = monthReturns.every((r) => r.submitted);
              const monthLabel = new Date(month + "-01").toLocaleDateString(
                "en-GB",
                { month: "long", year: "numeric" },
              );
              return (
                <Panel
                  key={month}
                  noPad
                  title={`Tax Month: ${monthLabel}`}
                  actions={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          exportCIS300(monthReturns, `CIS300-${month}.csv`)
                        }
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors hover:bg-[#e8e4dd]"
                        style={{
                          color: "#1b5e78",
                          border: "1px solid #d9d4ce",
                        }}
                        title="Download CIS300 CSV for HMRC submission"
                      >
                        <FileDown className="w-3.5 h-3.5" /> CIS300
                      </button>
                      {submitted ? (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: "rgba(42,110,69,0.1)",
                            color: GREEN,
                          }}
                        >
                          Submitted
                        </span>
                      ) : (
                        <Btn size="sm">Submit Return</Btn>
                      )}
                    </div>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr
                          style={{
                            borderBottom: "1px solid #d9d4ce",
                            backgroundColor: "#fafaf8",
                          }}
                        >
                          <th
                            className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: "#7a7469" }}
                          >
                            Subcontractor
                          </th>
                          <th
                            className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: "#7a7469" }}
                          >
                            UTR
                          </th>
                          <th
                            className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                            style={{ color: "#7a7469" }}
                          >
                            Rate
                          </th>
                          <th
                            className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                            style={{ color: "#7a7469" }}
                          >
                            Gross
                          </th>
                          <th
                            className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                            style={{ color: "#7a7469" }}
                          >
                            Deduction
                          </th>
                          <th
                            className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                            style={{ color: "#7a7469" }}
                          >
                            Net
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthReturns.map((r, i) => (
                          <tr
                            key={r.id}
                            className="transition-colors hover:bg-[#eeeae4] group"
                            style={{
                              borderBottom:
                                i < monthReturns.length - 1
                                  ? "1px solid #e8e4dd"
                                  : "none",
                            }}
                          >
                            <td
                              className="py-3 px-4 text-sm font-medium"
                              style={{ color: "#181410" }}
                            >
                              {r.subcontractor_name}
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum"
                              style={{ color: "#7a7469" }}
                            >
                              —
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum text-right"
                              style={{ color: "#7a7469" }}
                            >
                              {r.deduction_rate}%
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum text-right"
                              style={{ color: "#181410" }}
                            >
                              {formatCurrency(r.gross_payment)}
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum text-right"
                              style={{ color: "#c13a2a" }}
                            >
                              -{formatCurrency(r.deduction_amount)}
                            </td>
                            <td
                              className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                              style={{ color: "#181410" }}
                            >
                              {formatCurrency(r.net_payment)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr
                          style={{
                            borderTop: "1px solid #d9d4ce",
                            backgroundColor: "#fafaf8",
                          }}
                        >
                          <td
                            colSpan={3}
                            className="py-3 px-4 text-xs font-bold uppercase tracking-widest text-right"
                            style={{ color: "#7a7469" }}
                          >
                            Total
                          </td>
                          <td
                            className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                            style={{ color: "#181410" }}
                          >
                            {formatCurrency(
                              monthReturns.reduce(
                                (s, r) => s + r.gross_payment,
                                0,
                              ),
                            )}
                          </td>
                          <td
                            className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                            style={{ color: "#c13a2a" }}
                          >
                            -
                            {formatCurrency(
                              monthReturns.reduce(
                                (s, r) => s + r.deduction_amount,
                                0,
                              ),
                            )}
                          </td>
                          <td
                            className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                            style={{ color: "#181410" }}
                          >
                            {formatCurrency(
                              monthReturns.reduce(
                                (s, r) => s + r.net_payment,
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      )}

      {tab === "ratebook" && (
        <div className="space-y-6">
          <div
            className="flex items-center justify-between p-4 rounded-lg gw-shadow"
            style={{ backgroundColor: "#fafaf8", border: "1px solid #d9d4ce" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-sm font-medium"
                style={{ color: "#4a4540" }}
              >
                Category:
              </span>
              <select
                value={rateCategory}
                onChange={(e) => setRateCategory(e.target.value)}
                className="py-1.5 px-3 rounded-md text-sm font-medium focus:outline-none"
                style={{
                  backgroundColor: "#eeeae4",
                  border: "1px solid #d9d4ce",
                  color: "#181410",
                }}
              >
                {rateCategories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All Categories" : c}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs font-mono" style={{ color: "#7a7469" }}>
              {filteredRates.length} rates
            </span>
          </div>

          <div className="space-y-6">
            {rateCategories
              .filter((c) => c !== "all")
              .map((cat) => {
                const catRates = filteredRates.filter(
                  (r) => r.category === cat,
                );
                if (catRates.length === 0) return null;
                const avgTotal =
                  catRates.reduce((s, r) => s + r.total_rate, 0) /
                  catRates.length;
                return (
                  <Panel
                    key={cat}
                    noPad
                    title={cat}
                    actions={
                      <span
                        className="text-xs font-mono px-2 py-1 rounded"
                        style={{ backgroundColor: "#eeeae4", color: "#4a4540" }}
                      >
                        Avg £{avgTotal.toFixed(2)}/unit
                      </span>
                    }
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr
                            style={{
                              borderBottom: "1px solid #d9d4ce",
                              backgroundColor: "#fafaf8",
                            }}
                          >
                            <th
                              className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                              style={{ color: "#7a7469" }}
                            >
                              Description
                            </th>
                            <th
                              className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                              style={{ color: "#7a7469" }}
                            >
                              Unit
                            </th>
                            <th
                              className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                              style={{ color: "#7a7469" }}
                            >
                              Labour
                            </th>
                            <th
                              className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                              style={{ color: "#7a7469" }}
                            >
                              Material
                            </th>
                            <th
                              className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                              style={{ color: "#7a7469" }}
                            >
                              Plant
                            </th>
                            <th
                              className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                              style={{ color: "#7a7469" }}
                            >
                              Total
                            </th>
                            <th className="py-2.5 px-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {catRates.map((r, i) => (
                            <tr
                              key={r.id}
                              className="transition-colors hover:bg-[#eeeae4] group cursor-pointer"
                              style={{
                                borderBottom:
                                  i < catRates.length - 1
                                    ? "1px solid #e8e4dd"
                                    : "none",
                              }}
                            >
                              <td className="py-3 px-4">
                                <div
                                  className="text-sm font-medium"
                                  style={{ color: "#181410" }}
                                >
                                  {r.description}
                                </div>
                                {r.notes && (
                                  <div
                                    className="text-xs mt-0.5"
                                    style={{ color: "#7a7469" }}
                                  >
                                    {r.notes}
                                  </div>
                                )}
                              </td>
                              <td
                                className="py-3 px-4 text-sm font-mono"
                                style={{ color: "#7a7469" }}
                              >
                                {r.unit}
                              </td>
                              <td
                                className="py-3 px-4 text-sm font-mono tnum text-right"
                                style={{ color: "#7a7469" }}
                              >
                                £{r.labour_rate.toFixed(2)}
                              </td>
                              <td
                                className="py-3 px-4 text-sm font-mono tnum text-right"
                                style={{ color: "#7a7469" }}
                              >
                                £{r.material_rate.toFixed(2)}
                              </td>
                              <td
                                className="py-3 px-4 text-sm font-mono tnum text-right"
                                style={{ color: "#7a7469" }}
                              >
                                £{r.plant_rate.toFixed(2)}
                              </td>
                              <td
                                className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                                style={{ color: "#181410" }}
                              >
                                £{r.total_rate.toFixed(2)}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <ChevronRight
                                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ color: "#7a7469" }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function daysOld(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000),
  );
}
