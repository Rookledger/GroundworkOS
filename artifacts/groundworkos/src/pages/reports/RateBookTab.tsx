import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Panel } from "../../components/ui/Panel";
import type { RateBookEntry } from "../../types";
import { useRateBookData } from "./useRateBookData";

/**
 * Owns its own category-filter UI state (`rateCategory`) rather than taking
 * it as a prop - this filter is purely local, presentational state (it
 * doesn't affect the CSV export, which always exports the full rate book;
 * see ReportsPage.tsx), so there's no reason to lift it any higher. Every
 * derived value still comes from useRateBookData.ts, keeping the
 * data-hook/presentational split OverviewTab.tsx and friends follow.
 */
export function RateBookTab({ rateBook }: { rateBook: RateBookEntry[] }) {
  const [rateCategory, setRateCategory] = useState("all");
  const { categories, filteredRates, categoryGroups } = useRateBookData(
    rateBook,
    rateCategory,
  );

  return (
    <div className="space-y-6">
      <div
        className="flex items-center justify-between p-4 gw-shadow"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--ink-2)" }}
          >
            Category:
          </span>
          <select
            value={rateCategory}
            onChange={(e) => setRateCategory(e.target.value)}
            className="py-1.5 px-3 text-sm font-medium focus:outline-none"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--ink)",
            }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
          {filteredRates.length} rates
        </span>
      </div>

      <div className="space-y-6">
        {categoryGroups.map(({ category, rates, avgTotal }) => (
          <Panel
            key={category}
            noPad
            title={category}
            actions={
              <span
                className="text-xs font-mono px-2 py-1 "
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--ink-2)",
                }}
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
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--muted)" }}
                    >
                      Description
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--muted)" }}
                    >
                      Unit
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Labour
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Material
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Plant
                    </th>
                    <th
                      className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-right"
                      style={{ color: "var(--muted)" }}
                    >
                      Total
                    </th>
                    <th className="py-2.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r, i) => (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-[var(--surface-2)] group cursor-pointer"
                      style={{
                        borderBottom:
                          i < rates.length - 1
                            ? "1px solid var(--surface-3)"
                            : "none",
                      }}
                    >
                      <td className="py-3 px-4">
                        <div
                          className="text-sm font-medium"
                          style={{ color: "var(--ink)" }}
                        >
                          {r.description}
                        </div>
                        {r.notes && (
                          <div
                            className="text-xs mt-0.5"
                            style={{ color: "var(--muted)" }}
                          >
                            {r.notes}
                          </div>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono"
                        style={{ color: "var(--muted)" }}
                      >
                        {r.unit}
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono tnum text-right"
                        style={{ color: "var(--muted)" }}
                      >
                        £{r.labour_rate.toFixed(2)}
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono tnum text-right"
                        style={{ color: "var(--muted)" }}
                      >
                        £{r.material_rate.toFixed(2)}
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono tnum text-right"
                        style={{ color: "var(--muted)" }}
                      >
                        £{r.plant_rate.toFixed(2)}
                      </td>
                      <td
                        className="py-3 px-4 text-sm font-mono tnum font-bold text-right"
                        style={{ color: "var(--ink)" }}
                      >
                        £{r.total_rate.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <ChevronRight
                          strokeWidth={1.5}
                          className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: "var(--muted)" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
