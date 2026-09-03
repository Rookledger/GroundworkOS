import type { CISReturn, RateBookEntry } from "../../types";
import type { JobPLRow } from "./usePLData";
import type { CumulativeRevenuePoint } from "./useReportsData";

/**
 * Triggers a browser download of `rows` as a CSV file. Split from the
 * `buildXCSV` functions below so those pure "what goes in the file" builders
 * stay testable without a DOM (jsdom), while this one thin wrapper is the
 * only thing that touches `document`/`URL` - see the `buildXCSV` unit tests
 * in csvExport.test.ts for why that split matters.
 */
export function downloadCSV(
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
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface CSVSpec {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

export function buildRevenueSummaryCSV(
  cumulativeData: CumulativeRevenuePoint[],
): CSVSpec {
  return {
    filename: "revenue-summary.csv",
    headers: ["Month", "Invoiced (£)", "Collected (£)", "Cumulative (£)"],
    rows: cumulativeData.map((d) => [
      d.month,
      d.invoiced.toFixed(2),
      d.collected.toFixed(2),
      d.cumulative.toFixed(2),
    ]),
  };
}

export function buildJobPLCSV(jobRows: JobPLRow[]): CSVSpec {
  return {
    filename: `job-pl-${new Date().toISOString().slice(0, 10)}.csv`,
    headers: [
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
    rows: jobRows.map((r) => [
      r.job.job_number ?? "",
      r.job.title,
      r.job.status,
      r.contractValue.toFixed(2),
      r.invoiced.toFixed(2),
      r.collected.toFixed(2),
      r.labour.toFixed(2),
      r.materials.toFixed(2),
      r.totalCost.toFixed(2),
      // marginOnInvoiced mirrors the original page's CSV export, which used
      // the same contract-value-based `margin` figure shown in the table -
      // fall back to 0 for a zero-contract-value job rather than emitting
      // a blank cell.
      (r.margin ?? 0).toFixed(1),
    ]),
  };
}

export function buildCIS300CSV(
  returns: CISReturn[],
  filename: string,
): CSVSpec {
  return {
    filename,
    headers: [
      "Tax Month",
      "Subcontractor Name",
      "UTR Number",
      "Gross Payment (£)",
      "CIS Tax Deducted (£)",
      "Net Payment (£)",
      "Deduction Rate (%)",
      "Submitted",
    ],
    rows: returns.map((r) => [
      r.tax_month,
      r.subcontractor_name,
      r.utr ?? "",
      r.gross_payment.toFixed(2),
      r.deduction_amount.toFixed(2),
      r.net_payment.toFixed(2),
      r.deduction_rate,
      r.submitted ? "Yes" : "No",
    ]),
  };
}

export function buildRateBookCSV(rateBook: RateBookEntry[]): CSVSpec {
  return {
    filename: `rate-book-${new Date().toISOString().slice(0, 10)}.csv`,
    headers: [
      "Category",
      "Description",
      "Unit",
      "Labour Rate (£)",
      "Material Rate (£)",
      "Plant Rate (£)",
      "Total Rate (£)",
      "Notes",
    ],
    rows: rateBook.map((r) => [
      r.category,
      r.description,
      r.unit,
      r.labour_rate.toFixed(2),
      r.material_rate.toFixed(2),
      r.plant_rate.toFixed(2),
      r.total_rate.toFixed(2),
      r.notes ?? "",
    ]),
  };
}
