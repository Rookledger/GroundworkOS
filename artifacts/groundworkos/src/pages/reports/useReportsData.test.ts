import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Invoice, Job } from "../../types";
import { useReportsData } from "./useReportsData";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    invoice_number: "INV-0001",
    client_id: null,
    job_id: null,
    quote_id: null,
    subtotal: 100,
    vat_amount: 20,
    total_amount: 120,
    status: "paid",
    issued_date: "2026-08-01",
    due_date: "2026-08-15",
    paid_at: "2026-08-10",
    notes: null,
    created_at: "2026-08-01T00:00:00.000Z",
    cis_deduction: null,
    ...overrides,
  };
}

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

describe("useReportsData", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sums revenue collected/outstanding/overdue from invoice status", () => {
    const invoices = [
      makeInvoice({ id: "1", status: "paid", total_amount: 100 }),
      makeInvoice({ id: "2", status: "sent", total_amount: 50 }),
      makeInvoice({ id: "3", status: "overdue", total_amount: 30 }),
      makeInvoice({ id: "4", status: "credited", total_amount: 10 }),
    ];
    const { result } = renderHook(() => useReportsData(invoices, []));

    expect(result.current.totalRevenue).toBe(100);
    // Outstanding excludes paid and credited: sent (50) + overdue (30).
    expect(result.current.totalOutstanding).toBe(80);
    expect(result.current.overdueTotal).toBe(30);
    expect(result.current.unpaidCount).toBe(2);
  });

  it("computes collection rate as revenue / (revenue + outstanding)", () => {
    const invoices = [
      makeInvoice({ id: "1", status: "paid", total_amount: 75 }),
      makeInvoice({ id: "2", status: "sent", total_amount: 25 }),
    ];
    const { result } = renderHook(() => useReportsData(invoices, []));

    expect(result.current.collectionRate).toBe(75);
  });

  it("returns 0% collection rate with no invoiced value at all", () => {
    const { result } = renderHook(() => useReportsData([], []));
    expect(result.current.collectionRate).toBe(0);
  });

  it("excludes cancelled jobs from the pipeline total", () => {
    const jobs = [
      makeJob({ id: "1", status: "active", value: 1000 }),
      makeJob({ id: "2", status: "cancelled", value: 5000 }),
    ];
    const { result } = renderHook(() => useReportsData([], jobs));

    expect(result.current.totalPipeline).toBe(1000);
  });

  it("groups jobs-by-type, sorted by count descending", () => {
    const jobs = [
      makeJob({ id: "1", type: "drainage" }),
      makeJob({ id: "2", type: "drainage" }),
      makeJob({ id: "3", type: "kerbing" }),
    ];
    const { result } = renderHook(() => useReportsData([], jobs));

    expect(result.current.jobTypeData).toEqual([
      { name: "Drainage", value: 2 },
      { name: "Kerbing", value: 1 },
    ]);
  });

  it("buckets overdue/sent invoices by age into the aging buckets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));

    const invoices = [
      // 10 days old -> 0-30 bucket
      makeInvoice({
        id: "1",
        status: "overdue",
        due_date: "2026-08-22",
        total_amount: 40,
      }),
      // 45 days old -> 31-60 bucket
      makeInvoice({
        id: "2",
        status: "sent",
        due_date: "2026-07-18",
        total_amount: 60,
      }),
      // paid invoices never appear in aging buckets regardless of due_date
      makeInvoice({
        id: "3",
        status: "paid",
        due_date: "2026-01-01",
        total_amount: 999,
      }),
    ];
    const { result } = renderHook(() => useReportsData(invoices, []));

    const [b0, b1, b2, b3] = result.current.agingBuckets;
    expect(b0).toMatchObject({ label: "0–30 days", value: 40, count: 1 });
    expect(b1).toMatchObject({ label: "31–60 days", value: 60, count: 1 });
    expect(b2).toMatchObject({ count: 0 });
    expect(b3).toMatchObject({ count: 0 });
  });
});
