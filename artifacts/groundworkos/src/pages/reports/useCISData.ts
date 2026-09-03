import { useMemo } from "react";
import type { CISReturn } from "../../types";

export interface CISMonthGroup {
  month: string;
  monthLabel: string;
  returns: CISReturn[];
  submitted: boolean;
}

export interface ReportsCISData {
  cisPending: CISReturn[];
  cisTotalDeductions: number;
  cisPendingDeductions: number;
  monthGroups: CISMonthGroup[];
}

/**
 * The "CIS Return" tab's derived data: pending/filed deduction totals, and
 * returns grouped by tax month (newest first) with each group's own
 * "already submitted" flag. See useReportsData.ts's doc comment for why
 * this is a plain-argument hook.
 */
export function useCISData(cisReturns: CISReturn[]): ReportsCISData {
  return useMemo(() => {
    const cisPending = cisReturns.filter((r) => !r.submitted);
    const cisTotalDeductions = cisReturns
      .filter((r) => r.submitted)
      .reduce((s, r) => s + r.deduction_amount, 0);
    const cisPendingDeductions = cisPending.reduce(
      (s, r) => s + r.deduction_amount,
      0,
    );

    // Defensive filter: a tax_month can only ever be a real "YYYY-MM" period
    // (see DataLoader.tsx's mapCisReturn / api-server's cis.ts route). This
    // guards against ever rendering a group for a falsy/malformed value,
    // where `new Date(month + "-01")` would otherwise silently resolve to a
    // bogus date (e.g. "Tax Month: January 2001" for an empty string)
    // instead of failing loudly.
    const taxMonths = [...new Set(cisReturns.map((r) => r.tax_month))]
      .filter((m) => /^\d{4}-\d{2}$/.test(m))
      .sort()
      .reverse();

    const monthGroups: CISMonthGroup[] = taxMonths
      .map((month) => {
        const returns = cisReturns.filter((r) => r.tax_month === month);
        const monthLabel = new Date(month + "-01").toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        });
        return {
          month,
          monthLabel,
          returns,
          submitted: returns.every((r) => r.submitted),
        };
      })
      .filter((g) => g.returns.length > 0);

    return {
      cisPending,
      cisTotalDeductions,
      cisPendingDeductions,
      monthGroups,
    };
  }, [cisReturns]);
}
