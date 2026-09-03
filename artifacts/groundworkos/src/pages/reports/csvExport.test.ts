import { describe, expect, it } from "vitest";
import type { CISReturn, Job, RateBookEntry } from "../../types";
import {
  buildCIS300CSV,
  buildJobPLCSV,
  buildRateBookCSV,
  buildRevenueSummaryCSV,
} from "./csvExport";
import type { CumulativeRevenuePoint } from "./useReportsData";
import type { JobPLRow } from "./usePLData";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job_1",
    job_number: "J-0001",
    title: "Drainage works",
    client_id: null,
    type: "drainage",
    site_address: null,
    value: 1000,
    start_date: null,
    end_date: null,
    status: "active",
    progress_percent: 0,
    description: null,
    created_at: "2026-08-01T00:00:00.000Z",
    foreman: null,
    crew_count: null,
    nrswa_required: false,
    permit_number: null,
    ...overrides,
  };
}

describe("buildRevenueSummaryCSV", () => {
  it("formats each month's figures to 2dp and always names the file revenue-summary.csv", () => {
    const data: CumulativeRevenuePoint[] = [
      { month: "Aug", invoiced: 100, collected: 80, cumulative: 80 },
    ];
    const csv = buildRevenueSummaryCSV(data);

    expect(csv.filename).toBe("revenue-summary.csv");
    expect(csv.rows).toEqual([["Aug", "100.00", "80.00", "80.00"]]);
  });
});

describe("buildJobPLCSV", () => {
  it("defaults a null margin (zero contract value) to 0 in the exported row", () => {
    const row: JobPLRow = {
      job: makeJob({ value: 0 }),
      invoiced: 0,
      collected: 0,
      labour: 0,
      materials: 0,
      totalCost: 0,
      contractValue: 0,
      margin: null,
      marginOnInvoiced: null,
    };
    const csv = buildJobPLCSV([row]);

    // Margin (%) is the last column.
    expect(csv.rows[0].at(-1)).toBe("0.0");
  });

  it("includes the job number, title and status columns", () => {
    const row: JobPLRow = {
      job: makeJob({
        job_number: "J-0042",
        title: "Test Job",
        status: "active",
      }),
      invoiced: 500,
      collected: 500,
      labour: 100,
      materials: 50,
      totalCost: 150,
      contractValue: 1000,
      margin: 85,
      marginOnInvoiced: 70,
    };
    const csv = buildJobPLCSV([row]);

    expect(csv.rows[0].slice(0, 3)).toEqual(["J-0042", "Test Job", "active"]);
  });
});

describe("buildCIS300CSV", () => {
  it("uses the given filename and maps submitted to Yes/No", () => {
    const returns: CISReturn[] = [
      {
        id: "1",
        tax_month: "2026-08",
        subcontractor_id: "sub_1",
        subcontractor_name: "J. Bloggs",
        utr: null,
        gross_payment: 1000,
        deduction_rate: 20,
        deduction_amount: 200,
        net_payment: 800,
        submitted: true,
        submitted_at: "2026-08-19T00:00:00.000Z",
      },
    ];
    const csv = buildCIS300CSV(returns, "CIS300-2026-08.csv");

    expect(csv.filename).toBe("CIS300-2026-08.csv");
    expect(csv.rows[0].at(-1)).toBe("Yes");
  });
});

describe("buildRateBookCSV", () => {
  it("maps every rate row to its own CSV row", () => {
    const rateBook: RateBookEntry[] = [
      {
        id: "1",
        category: "Drainage",
        description: "150mm pipe laying",
        unit: "m",
        labour_rate: 10,
        material_rate: 5,
        plant_rate: 2,
        total_rate: 17,
        notes: null,
      },
    ];
    const csv = buildRateBookCSV(rateBook);

    expect(csv.rows).toEqual([
      [
        "Drainage",
        "150mm pipe laying",
        "m",
        "10.00",
        "5.00",
        "2.00",
        "17.00",
        "",
      ],
    ]);
  });
});
