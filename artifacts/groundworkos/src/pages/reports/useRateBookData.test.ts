import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RateBookEntry } from "../../types";
import { useRateBookData } from "./useRateBookData";

function makeRate(overrides: Partial<RateBookEntry> = {}): RateBookEntry {
  return {
    id: "rate_1",
    category: "Drainage",
    description: "150mm pipe laying",
    unit: "m",
    labour_rate: 10,
    material_rate: 5,
    plant_rate: 2,
    total_rate: 17,
    notes: null,
    ...overrides,
  };
}

describe("useRateBookData", () => {
  it("includes 'all' plus every distinct category", () => {
    const rateBook = [
      makeRate({ id: "1", category: "Drainage" }),
      makeRate({ id: "2", category: "Kerbing" }),
      makeRate({ id: "3", category: "Drainage" }),
    ];
    const { result } = renderHook(() => useRateBookData(rateBook, "all"));

    expect(result.current.categories).toEqual(["all", "Drainage", "Kerbing"]);
  });

  it("filters rates to the selected category", () => {
    const rateBook = [
      makeRate({ id: "1", category: "Drainage" }),
      makeRate({ id: "2", category: "Kerbing" }),
    ];
    const { result } = renderHook(() => useRateBookData(rateBook, "Kerbing"));

    expect(result.current.filteredRates).toHaveLength(1);
    expect(result.current.filteredRates[0].id).toBe("2");
  });

  it("computes each category group's average total rate", () => {
    const rateBook = [
      makeRate({ id: "1", category: "Drainage", total_rate: 10 }),
      makeRate({ id: "2", category: "Drainage", total_rate: 20 }),
    ];
    const { result } = renderHook(() => useRateBookData(rateBook, "all"));

    expect(result.current.categoryGroups).toEqual([
      expect.objectContaining({ category: "Drainage", avgTotal: 15 }),
    ]);
  });
});
