import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Invoice, Job, PurchaseOrder, Timesheet } from "../../types";
import { usePLData } from "./usePLData";

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

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    invoice_number: "INV-0001",
    client_id: null,
    job_id: "job_1",
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

function makeTimesheet(overrides: Partial<Timesheet> = {}): Timesheet {
  return {
    id: "ts_1",
    job_id: "job_1",
    job_number: "J-0001",
    job_title: "Drainage works",
    worker_name: "A. Worker",
    work_date: "2026-08-01",
    hours_worked: 8,
    day_rate: 200,
    cost: 200,
    description: null,
    created_by: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePO(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: "po_1",
    po_number: "PO-0001",
    job_id: "job_1",
    job_number: "J-0001",
    job_title: "Drainage works",
    supplier: "Acme Materials",
    description: "Pipes",
    amount: 100,
    vat_amount: 20,
    total_amount: 120,
    status: "ordered",
    order_date: "2026-08-01",
    expected_delivery: null,
    delivery_date: null,
    notes: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("usePLData", () => {
  it("excludes cancelled jobs from active jobs and totals", () => {
    const jobs = [
      makeJob({ id: "job_1", status: "active", value: 1000 }),
      makeJob({ id: "job_2", status: "cancelled", value: 5000 }),
    ];
    const { result } = renderHook(() => usePLData(jobs, [], [], []));

    expect(result.current.activeJobs).toHaveLength(1);
    expect(result.current.totalContractValue).toBe(1000);
  });

  it("computes per-job labour/materials/margin from timesheets and POs scoped to that job", () => {
    const jobs = [makeJob({ id: "job_1", value: 1000 })];
    const timesheets = [
      makeTimesheet({ job_id: "job_1", cost: 200 }),
      makeTimesheet({ id: "ts_2", job_id: "job_other", cost: 999 }),
    ];
    const purchaseOrders = [makePO({ job_id: "job_1", total_amount: 300 })];
    const { result } = renderHook(() =>
      usePLData(jobs, [], timesheets, purchaseOrders),
    );

    const row = result.current.jobRows[0];
    expect(row.labour).toBe(200);
    expect(row.materials).toBe(300);
    expect(row.totalCost).toBe(500);
    // margin = (contractValue - totalCost) / contractValue * 100
    expect(row.margin).toBeCloseTo(50);
  });

  it("reports a null margin (not 0) for a job with no contract value", () => {
    const jobs = [makeJob({ id: "job_1", value: null })];
    const { result } = renderHook(() => usePLData(jobs, [], [], []));

    expect(result.current.jobRows[0].margin).toBeNull();
  });

  it("only counts paid invoices toward collected", () => {
    const jobs = [makeJob({ id: "job_1" })];
    const invoices = [
      makeInvoice({
        id: "1",
        job_id: "job_1",
        status: "paid",
        total_amount: 100,
      }),
      makeInvoice({
        id: "2",
        job_id: "job_1",
        status: "sent",
        total_amount: 50,
      }),
    ];
    const { result } = renderHook(() => usePLData(jobs, invoices, [], []));

    const row = result.current.jobRows[0];
    expect(row.invoiced).toBe(150);
    expect(row.collected).toBe(100);
  });
});
