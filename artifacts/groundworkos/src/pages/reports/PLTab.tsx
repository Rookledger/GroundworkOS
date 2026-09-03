import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Panel } from "../../components/ui/Panel";
import { StatCard } from "../../components/ui/StatCard";
import { formatCurrency } from "../../lib/utils";
import { CustomTooltip } from "./CustomTooltip";
import { GREEN, ORANGE, RED } from "./types";
import type { ReportsPLData } from "./usePLData";

/** Purely presentational - see OverviewTab.tsx's header comment. */
export function PLTab({ data }: { data: ReportsPLData }) {
  const {
    activeJobs,
    jobRows,
    totalContractValue,
    totalLabour,
    totalMaterials,
    totalCost,
    overallMargin,
    plChartData,
    timesheetsCount,
    purchaseOrdersCount,
  } = data;

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
          sub={`${timesheetsCount} timesheet entries`}
        />
        <StatCard
          label="Materials Cost"
          value={formatCurrency(totalMaterials)}
          sub={`${purchaseOrdersCount} purchase orders`}
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
                  stroke="var(--surface-3)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="name"
                  tick={{
                    fill: "var(--muted)",
                    fontSize: 10,
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
                  width={42}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                />
                <Bar
                  dataKey="Revenue"
                  fill="var(--accent)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="Labour"
                  fill="var(--warning)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="Materials"
                  fill="var(--ink-2)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            className="flex items-center gap-6 mt-4 pt-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {[
              ["var(--accent)", "Revenue"],
              ["var(--warning)", "Labour"],
              ["var(--ink-2)", "Materials"],
            ].map(([color, label]) => (
              <div
                key={label}
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--muted)" }}
              >
                <span
                  className="w-3 h-3 inline-block"
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
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
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
                    style={{ color: "var(--muted)" }}
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
                    ? "var(--muted-2)"
                    : margin >= 20
                      ? GREEN
                      : margin >= 0
                        ? ORANGE
                        : RED;
                return (
                  <tr
                    key={r.job.id}
                    className="transition-colors hover:bg-[var(--surface-2)]"
                    style={{
                      borderBottom:
                        i < jobRows.length - 1
                          ? "1px solid var(--surface-3)"
                          : "none",
                    }}
                  >
                    <td className="py-3 px-4">
                      <div
                        className="text-sm font-mono font-semibold"
                        style={{ color: "var(--accent)" }}
                      >
                        {r.job.job_number}
                      </div>
                      <div
                        className="text-xs mt-0.5 max-w-[180px] truncate"
                        style={{ color: "var(--muted)" }}
                      >
                        {r.job.title}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 "
                        style={{
                          backgroundColor:
                            r.job.status === "active"
                              ? "rgba(42,110,69,0.1)"
                              : r.job.status === "complete"
                                ? "var(--accent-bg)"
                                : "var(--surface-2)",
                          color:
                            r.job.status === "active"
                              ? GREEN
                              : r.job.status === "complete"
                                ? "var(--accent)"
                                : "var(--muted)",
                        }}
                      >
                        {r.job.status}
                      </span>
                    </td>
                    <td
                      className="py-3 px-4 text-sm font-mono tnum font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {r.contractValue > 0
                        ? formatCurrency(r.contractValue)
                        : "—"}
                    </td>
                    <td
                      className="py-3 px-4 text-sm font-mono tnum"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {r.invoiced > 0 ? formatCurrency(r.invoiced) : "—"}
                    </td>
                    <td
                      className="py-3 px-4 text-sm font-mono tnum"
                      style={{
                        color:
                          r.labour > 0 ? "var(--warning)" : "var(--border)",
                      }}
                    >
                      {r.labour > 0 ? formatCurrency(r.labour) : "—"}
                    </td>
                    <td
                      className="py-3 px-4 text-sm font-mono tnum"
                      style={{
                        color:
                          r.materials > 0 ? "var(--ink-2)" : "var(--border)",
                      }}
                    >
                      {r.materials > 0 ? formatCurrency(r.materials) : "—"}
                    </td>
                    <td
                      className="py-3 px-4 text-sm font-mono tnum font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {r.totalCost > 0 ? formatCurrency(r.totalCost) : "—"}
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
                            className="h-1 mt-1.5 overflow-hidden"
                            style={{
                              width: 60,
                              backgroundColor: "var(--surface-3)",
                            }}
                          >
                            <div
                              className="h-full "
                              style={{
                                width: `${Math.min(100, Math.max(0, margin))}%`,
                                backgroundColor: marginColor,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--border)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr
                style={{
                  borderTop: "2px solid var(--border)",
                  backgroundColor: "var(--surface)",
                }}
              >
                <td
                  colSpan={2}
                  className="py-3 px-4 text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--muted)" }}
                >
                  Totals
                </td>
                <td
                  className="py-3 px-4 text-sm font-mono font-bold tnum"
                  style={{ color: "var(--ink)" }}
                >
                  {formatCurrency(totalContractValue)}
                </td>
                <td
                  className="py-3 px-4 text-sm font-mono tnum"
                  style={{ color: "var(--ink-2)" }}
                >
                  {formatCurrency(jobRows.reduce((s, r) => s + r.invoiced, 0))}
                </td>
                <td
                  className="py-3 px-4 text-sm font-mono tnum font-bold"
                  style={{ color: "var(--warning)" }}
                >
                  {formatCurrency(totalLabour)}
                </td>
                <td
                  className="py-3 px-4 text-sm font-mono tnum font-bold"
                  style={{ color: "var(--ink-2)" }}
                >
                  {formatCurrency(totalMaterials)}
                </td>
                <td
                  className="py-3 px-4 text-sm font-mono tnum font-bold"
                  style={{ color: "var(--ink)" }}
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
}
