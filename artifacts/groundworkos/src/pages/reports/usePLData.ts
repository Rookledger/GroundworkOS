import { useMemo } from "react";
import type { Invoice, Job, PurchaseOrder, Timesheet } from "../../types";

export interface JobPLRow {
  job: Job;
  invoiced: number;
  collected: number;
  labour: number;
  materials: number;
  totalCost: number;
  contractValue: number;
  margin: number | null;
  marginOnInvoiced: number | null;
}

export interface PLChartPoint {
  name: string;
  Revenue: number;
  Labour: number;
  Materials: number;
}

export interface ReportsPLData {
  activeJobs: Job[];
  jobRows: JobPLRow[];
  totalContractValue: number;
  totalLabour: number;
  totalMaterials: number;
  totalCost: number;
  overallMargin: number;
  plChartData: PLChartPoint[];
  timesheetsCount: number;
  purchaseOrdersCount: number;
}

/**
 * The "Job P&L" tab's derived data - per-job revenue/cost/margin, and the
 * totals row/chart built from it. See useReportsData.ts's doc comment for
 * why this is a plain-argument hook rather than one that calls useApp()
 * itself.
 */
export function usePLData(
  jobs: Job[],
  invoices: Invoice[],
  timesheets: Timesheet[],
  purchaseOrders: PurchaseOrder[],
): ReportsPLData {
  return useMemo(() => {
    const activeJobs = jobs.filter((j) => j.status !== "cancelled");

    const jobRows: JobPLRow[] = activeJobs
      .map((j) => {
        const jobInvoices = invoices.filter((i) => i.job_id === j.id);
        const invoiced = jobInvoices.reduce((s, i) => s + i.total_amount, 0);
        const collected = jobInvoices
          .filter((i) => i.status === "paid")
          .reduce((s, i) => s + i.total_amount, 0);
        const labour = timesheets
          .filter((t) => t.job_id === j.id)
          .reduce((s, t) => s + (t.cost ?? 0), 0);
        const materials = purchaseOrders
          .filter((o) => o.job_id === j.id)
          .reduce((s, o) => s + o.total_amount, 0);
        const totalCost = labour + materials;
        const contractValue = j.value ?? 0;
        const margin =
          contractValue > 0
            ? ((contractValue - totalCost) / contractValue) * 100
            : null;
        const marginOnInvoiced =
          invoiced > 0 ? ((invoiced - totalCost) / invoiced) * 100 : null;
        return {
          job: j,
          invoiced,
          collected,
          labour,
          materials,
          totalCost,
          contractValue,
          margin,
          marginOnInvoiced,
        };
      })
      .sort((a, b) => b.contractValue - a.contractValue);

    const totalContractValue = jobRows.reduce((s, r) => s + r.contractValue, 0);
    const totalLabour = jobRows.reduce((s, r) => s + r.labour, 0);
    const totalMaterials = jobRows.reduce((s, r) => s + r.materials, 0);
    const totalCost = totalLabour + totalMaterials;
    const overallMargin =
      totalContractValue > 0
        ? ((totalContractValue - totalCost) / totalContractValue) * 100
        : 0;

    const plChartData: PLChartPoint[] = jobRows.slice(0, 8).map((r) => ({
      name: r.job.job_number ?? r.job.title.slice(0, 12),
      Revenue: r.invoiced,
      Labour: r.labour,
      Materials: r.materials,
    }));

    return {
      activeJobs,
      jobRows,
      totalContractValue,
      totalLabour,
      totalMaterials,
      totalCost,
      overallMargin,
      plChartData,
      timesheetsCount: timesheets.length,
      purchaseOrdersCount: purchaseOrders.length,
    };
  }, [jobs, invoices, timesheets, purchaseOrders]);
}
