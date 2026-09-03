import { useState } from "react";
import { Download } from "lucide-react";
import { Btn } from "../components/ui/Btn";
import { useApp } from "../store/AppContext";
import type { RateBookEntry } from "../types";
import {
  buildCIS300CSV,
  buildJobPLCSV,
  buildRateBookCSV,
  buildRevenueSummaryCSV,
  downloadCSV,
} from "./reports/csvExport";
import { CISTab } from "./reports/CISTab";
import { OverviewTab } from "./reports/OverviewTab";
import { PLTab } from "./reports/PLTab";
import { RateBookTab } from "./reports/RateBookTab";
import type { ReportTab } from "./reports/types";
import { useCISData } from "./reports/useCISData";
import { usePLData } from "./reports/usePLData";
import { useReportsData } from "./reports/useReportsData";

/**
 * Tech-debt audit finding #14 ("15 page components over 500 lines, one at
 * 1,661") picked this page - the single largest - as a worked example of
 * the fix, rather than mechanically applying it to all 15: a
 * data-hook + presentational-component split, so each tab's derived data
 * (useReportsData.ts / usePLData.ts / useCISData.ts / useRateBookData.ts,
 * all independently unit-testable - see their .test.ts files) is separate
 * from how it's rendered (OverviewTab.tsx / PLTab.tsx / CISTab.tsx /
 * RateBookTab.tsx, plus the shared CustomTooltip.tsx). This file is left
 * doing only three things: reading the raw app state, choosing which tab's
 * hook/component pair is active, and wiring the header's CSV export button
 * to whichever tab is showing.
 *
 * The other 14 large pages (SchedulePage.tsx, JobsPage.tsx, etc.) are
 * intentionally NOT touched here - see TECH_DEBT_AUDIT.md finding #14 for
 * why doing all of them was out of scope for this pass, and this page's
 * `reports/` directory for the pattern to repeat on the next one.
 */
export function ReportsPage() {
  const { state } = useApp();
  const { invoices, jobs, cisReturns, rateBook, timesheets, purchaseOrders } =
    state;
  const typedRateBook = rateBook as RateBookEntry[];

  const [tab, setTab] = useState<ReportTab>("overview");

  const overviewData = useReportsData(invoices, jobs);
  const plData = usePLData(jobs, invoices, timesheets, purchaseOrders);
  const cisData = useCISData(cisReturns);

  const exportLabel: Record<ReportTab, string> = {
    overview: "Revenue CSV",
    pl: "P&L CSV",
    cis: "CIS300 CSV",
    ratebook: "Rate Book CSV",
  };

  function exportCurrentTab() {
    if (tab === "overview") {
      const csv = buildRevenueSummaryCSV(overviewData.cumulativeData);
      downloadCSV(csv.filename, csv.headers, csv.rows);
    } else if (tab === "pl") {
      const csv = buildJobPLCSV(plData.jobRows);
      downloadCSV(csv.filename, csv.headers, csv.rows);
    } else if (tab === "cis") {
      const csv = buildCIS300CSV(cisReturns, "cis300-all.csv");
      downloadCSV(csv.filename, csv.headers, csv.rows);
    } else if (tab === "ratebook") {
      const csv = buildRateBookCSV(typedRateBook);
      downloadCSV(csv.filename, csv.headers, csv.rows);
    }
  }

  function exportCISMonth(month: string) {
    const monthReturns = cisReturns.filter((r) => r.tax_month === month);
    const csv = buildCIS300CSV(monthReturns, `CIS300-${month}.csv`);
    downloadCSV(csv.filename, csv.headers, csv.rows);
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Reports
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Financial reports, CIS returns & rate book
          </p>
        </div>
        <Btn variant="outline" size="sm" onClick={exportCurrentTab}>
          <Download strokeWidth={1.5} className="w-3.5 h-3.5" /> Export{" "}
          {exportLabel[tab]}
        </Btn>
      </div>

      <div
        className="flex items-center gap-1"
        style={{ borderBottom: "1px solid var(--border)" }}
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
                    color: "var(--ink)",
                    fontWeight: 500,
                    borderBottom: "2px solid var(--accent)",
                    marginBottom: "-1px",
                  }
                : { color: "var(--muted)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab data={overviewData} />}
      {tab === "pl" && <PLTab data={plData} />}
      {tab === "cis" && (
        <CISTab data={cisData} onExportMonth={exportCISMonth} />
      )}
      {tab === "ratebook" && <RateBookTab rateBook={typedRateBook} />}
    </div>
  );
}
