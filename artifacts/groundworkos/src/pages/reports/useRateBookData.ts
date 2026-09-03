import { useMemo } from "react";
import type { RateBookEntry } from "../../types";

export interface RateBookCategoryGroup {
  category: string;
  rates: RateBookEntry[];
  avgTotal: number;
}

export interface ReportsRateBookData {
  categories: string[];
  filteredRates: RateBookEntry[];
  categoryGroups: RateBookCategoryGroup[];
}

/**
 * The "Rate Book" tab's derived data for a given category filter
 * (`"all"` or a specific category): the category list for the filter
 * dropdown, the filtered rate rows, and those rows grouped by category with
 * a per-category average total rate. See useReportsData.ts's doc comment
 * for why this is a plain-argument hook.
 */
export function useRateBookData(
  rateBook: RateBookEntry[],
  category: string,
): ReportsRateBookData {
  return useMemo(() => {
    const categories = [
      "all",
      ...Array.from(new Set(rateBook.map((r) => r.category))),
    ];
    const filteredRates = rateBook.filter(
      (r) => category === "all" || r.category === category,
    );

    const categoryGroups: RateBookCategoryGroup[] = categories
      .filter((c) => c !== "all")
      .map((cat) => {
        const rates = filteredRates.filter((r) => r.category === cat);
        const avgTotal =
          rates.length > 0
            ? rates.reduce((s, r) => s + r.total_rate, 0) / rates.length
            : 0;
        return { category: cat, rates, avgTotal };
      })
      .filter((g) => g.rates.length > 0);

    return { categories, filteredRates, categoryGroups };
  }, [rateBook, category]);
}
