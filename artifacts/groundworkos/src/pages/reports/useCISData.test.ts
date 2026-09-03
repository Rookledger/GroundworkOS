import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { CISReturn } from "../../types";
import { useCISData } from "./useCISData";

function makeReturn(overrides: Partial<CISReturn> = {}): CISReturn {
  return {
    id: "cis_1",
    tax_month: "2026-08",
    subcontractor_id: "sub_1",
    subcontractor_name: "J. Bloggs Groundworks",
    utr: "1234567890",
    gross_payment: 1000,
    deduction_rate: 20,
    deduction_amount: 200,
    net_payment: 800,
    submitted: false,
    submitted_at: null,
    ...overrides,
  };
}

describe("useCISData", () => {
  it("only totals deductions from submitted returns", () => {
    const returns = [
      makeReturn({ id: "1", submitted: true, deduction_amount: 200 }),
      makeReturn({ id: "2", submitted: false, deduction_amount: 300 }),
    ];
    const { result } = renderHook(() => useCISData(returns));

    expect(result.current.cisTotalDeductions).toBe(200);
    expect(result.current.cisPendingDeductions).toBe(300);
    expect(result.current.cisPending).toHaveLength(1);
  });

  it("groups returns by tax month, newest first", () => {
    const returns = [
      makeReturn({ id: "1", tax_month: "2026-06" }),
      makeReturn({ id: "2", tax_month: "2026-08" }),
      makeReturn({ id: "3", tax_month: "2026-07" }),
    ];
    const { result } = renderHook(() => useCISData(returns));

    expect(result.current.monthGroups.map((g) => g.month)).toEqual([
      "2026-08",
      "2026-07",
      "2026-06",
    ]);
  });

  it("marks a month group submitted only when every return in it is submitted", () => {
    const returns = [
      makeReturn({ id: "1", tax_month: "2026-08", submitted: true }),
      makeReturn({ id: "2", tax_month: "2026-08", submitted: false }),
    ];
    const { result } = renderHook(() => useCISData(returns));

    expect(result.current.monthGroups[0].submitted).toBe(false);
  });

  it("drops a malformed tax_month rather than rendering a bogus date group", () => {
    const returns = [
      makeReturn({ id: "1", tax_month: "" }),
      makeReturn({ id: "2", tax_month: "not-a-month" }),
      makeReturn({ id: "3", tax_month: "2026-08" }),
    ];
    const { result } = renderHook(() => useCISData(returns));

    expect(result.current.monthGroups).toHaveLength(1);
    expect(result.current.monthGroups[0].month).toBe("2026-08");
  });
});
