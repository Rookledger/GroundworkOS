import { FileDown } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import { StatCard } from "../../components/ui/StatCard";
import { Btn } from "../../components/ui/Btn";
import { formatCurrency } from "../../lib/utils";
import { GREEN } from "./types";
import type { ReportsCISData } from "./useCISData";

/**
 * Purely presentational - see OverviewTab.tsx's header comment.
 * `onExportMonth` is the one piece of behavior this tab needs from its
 * parent (downloading a single tax month's CIS300 CSV), passed down rather
 * than importing csvExport.ts directly, so this component stays a plain
 * function of its props for testing/Storybook-style use.
 */
export function CISTab({
  data,
  onExportMonth,
}: {
  data: ReportsCISData;
  onExportMonth: (month: string) => void;
}) {
  const { cisPending, cisTotalDeductions, cisPendingDeductions, monthGroups } =
    data;

  return (
    <div className="space-y-6">
      <div
        className="flex items-start gap-3 p-4 "
        style={{
          backgroundColor: "var(--accent-bg)",
          border: "1px solid rgba(27,94,120,0.2)",
        }}
      >
        <div className="flex-1">
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: "var(--accent)" }}
          >
            Construction Industry Scheme (CIS)
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--ink-2)" }}
          >
            Monthly returns must be filed with HMRC by the 19th of the following
            tax month. Deductions must be made from subcontractors verified as
            "net" or "unverified".
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
          value={formatCurrency(cisPendingDeductions)}
        />
      </div>

      <div className="space-y-6">
        {monthGroups.map(({ month, monthLabel, returns, submitted }) => (
          <Panel
            key={month}
            noPad
            title={`Tax Month: ${monthLabel}`}
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onExportMonth(month)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 transition-colors hover:bg-[var(--surface-3)]"
                  style={{
                    color: "var(--accent)",
                    border: "1px solid var(--border)",
                  }}
                  title="Download CIS300 CSV for HMRC submission"
                >
                  <FileDown strokeWidth={1.5} className="w-3.5 h-3.5" /> CIS300
                </button>
                {submitted ? (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 "
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
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--muted)" }}
                    >
                      Subcontractor
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--muted)" }}
                    >
                      UTR
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Rate
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Gross
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Deduction
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Net
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r, i) => (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-[var(--surface-2)] group"
                      style={{
                        borderBottom:
                          i < returns.length - 1
                            ? "1px solid var(--surface-3)"
                            : "none",
                      }}
                    >
                      <td
                        className="py-3 px-4 text-sm font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {r.subcontractor_name}
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono tnum"
                        style={{ color: "var(--muted)" }}
                      >
                        —
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono tnum text-right"
                        style={{ color: "var(--muted)" }}
                      >
                        {r.deduction_rate}%
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono tnum text-right"
                        style={{ color: "var(--ink)" }}
                      >
                        {formatCurrency(r.gross_payment)}
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono tnum text-right"
                        style={{ color: "var(--danger)" }}
                      >
                        -{formatCurrency(r.deduction_amount)}
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                        style={{ color: "var(--ink)" }}
                      >
                        {formatCurrency(r.net_payment)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      borderTop: "1px solid var(--border)",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    <td
                      colSpan={3}
                      className="py-3 px-4 text-xs font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Total
                    </td>
                    <td
                      className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                      style={{ color: "var(--ink)" }}
                    >
                      {formatCurrency(
                        returns.reduce((s, r) => s + r.gross_payment, 0),
                      )}
                    </td>
                    <td
                      className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                      style={{ color: "var(--danger)" }}
                    >
                      -
                      {formatCurrency(
                        returns.reduce((s, r) => s + r.deduction_amount, 0),
                      )}
                    </td>
                    <td
                      className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                      style={{ color: "var(--ink)" }}
                    >
                      {formatCurrency(
                        returns.reduce((s, r) => s + r.net_payment, 0),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
