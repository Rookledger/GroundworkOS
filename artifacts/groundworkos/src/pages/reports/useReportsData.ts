import { useMemo } from "react";
import type { Invoice, Job } from "../../types";
import { GREEN, ORANGE, YELLOW, BLUE } from "./types";

export interface MonthRevenuePoint {
  month: string;
  invoiced: number;
  collected: number;
}

export interface CumulativeRevenuePoint extends MonthRevenuePoint {
  cumulative: number;
}

export interface PipelineByStatusEntry {
  label: string;
  color: string;
  count: number;
  value: number;
}

export interface JobTypeEntry {
  name: string;
  value: number;
}

export interface AgingBucket {
  label: string;
  value: number;
  count: number;
}

export interface ReportsOverviewData {
  totalRevenue: number;
  totalOutstanding: number;
  unpaidCount: number;
  totalPipeline: number;
  overdueInvoices: Invoice[];
  overdueTotal: number;
  paidInvoices: Invoice[];
  collectionRate: number;
  revenueData: MonthRevenuePoint[];
  cumulativeData: CumulativeRevenuePoint[];
  pipelineByStatus: PipelineByStatusEntry[];
  jobTypeData: JobTypeEntry[];
  agingBuckets: AgingBucket[];
}

function daysOld(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000),
  );
}

/**
 * All of the "Overview" tab's derived data: revenue/collection totals, the
 * last-6-months revenue chart series, pipeline-by-status, jobs-by-type, and
 * aged-debtor buckets. Pulled out of ReportsPage.tsx (tech-debt audit
 * finding #14) as this page's data-hook/presentational-component split
 * template: this hook owns every calculation, `OverviewTab.tsx` only
 * renders the numbers it's handed.
 *
 * Takes `invoices`/`jobs` as plain arguments rather than calling useApp()
 * itself, so it stays a pure function of its inputs and can be exercised in
 * a unit test (see useReportsData.test.ts) without mounting the app's
 * provider tree.
 */
export function useReportsData(
  invoices: Invoice[],
  jobs: Job[],
): ReportsOverviewData {
  return useMemo(() => {
    const paidInvoices = invoices.filter((i) => i.status === "paid");
    const totalRevenue = paidInvoices.reduce((s, i) => s + i.total_amount, 0);
    const totalOutstanding = invoices
      .filter((i) => i.status !== "paid" && i.status !== "credited")
      .reduce((s, i) => s + i.total_amount, 0);
    const totalPipeline = jobs
      .filter((j) => j.status !== "cancelled")
      .reduce((s, j) => s + (j.value ?? 0), 0);
    const overdueInvoices = invoices.filter((i) => i.status === "overdue");
    const overdueTotal = overdueInvoices.reduce(
      (s, i) => s + i.total_amount,
      0,
    );
    const unpaidCount = invoices.filter(
      (i) => i.status === "sent" || i.status === "overdue",
    ).length;

    const monthMap = new Map<string, MonthRevenuePoint>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, {
        invoiced: 0,
        collected: 0,
        month: d.toLocaleDateString("en-GB", { month: "short" }),
      });
    }
    for (const inv of invoices) {
      const key = inv.issued_date?.slice(0, 7) ?? "";
      if (monthMap.has(key)) monthMap.get(key)!.invoiced += inv.total_amount;
    }
    for (const inv of paidInvoices) {
      if (!inv.paid_at) continue;
      const key = inv.paid_at.slice(0, 7);
      if (monthMap.has(key)) monthMap.get(key)!.collected += inv.total_amount;
    }
    const revenueData = Array.from(monthMap.values());

    let cumulative = 0;
    const cumulativeData: CumulativeRevenuePoint[] = revenueData.map((d) => {
      cumulative += d.collected;
      return { ...d, cumulative };
    });

    const pipelineByStatus: PipelineByStatusEntry[] = [
      { label: "Active", status: "active", color: GREEN },
      { label: "Quoted", status: "quoted", color: YELLOW },
      { label: "Complete", status: "complete", color: BLUE },
      { label: "On Hold", status: "on_hold", color: ORANGE },
    ].map(({ label, status, color }) => {
      const pJobs = jobs.filter((j) => j.status === status);
      return {
        label,
        color,
        count: pJobs.length,
        value: pJobs.reduce((s, j) => s + (j.value ?? 0), 0),
      };
    });

    const jobTypeData: JobTypeEntry[] = Object.entries(
      jobs.reduce(
        (acc, j) => {
          if (!j.type) return acc;
          acc[j.type] = (acc[j.type] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    )
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: count,
      }))
      .sort((a, b) => b.value - a.value);

    const agingBuckets: AgingBucket[] = [
      {
        label: "0–30 days",
        invoices: invoices.filter(
          (i) =>
            (i.status === "sent" || i.status === "overdue") &&
            daysOld(i.due_date) <= 30,
        ),
      },
      {
        label: "31–60 days",
        invoices: invoices.filter(
          (i) =>
            (i.status === "sent" || i.status === "overdue") &&
            daysOld(i.due_date) > 30 &&
            daysOld(i.due_date) <= 60,
        ),
      },
      {
        label: "61–90 days",
        invoices: invoices.filter(
          (i) =>
            (i.status === "sent" || i.status === "overdue") &&
            daysOld(i.due_date) > 60 &&
            daysOld(i.due_date) <= 90,
        ),
      },
      {
        label: "90+ days",
        invoices: invoices.filter(
          (i) =>
            (i.status === "sent" || i.status === "overdue") &&
            daysOld(i.due_date) > 90,
        ),
      },
    ].map((b) => ({
      label: b.label,
      value: b.invoices.reduce((s, i) => s + i.total_amount, 0),
      count: b.invoices.length,
    }));

    const collectionRate =
      totalRevenue + totalOutstanding > 0
        ? Math.round((totalRevenue / (totalRevenue + totalOutstanding)) * 100)
        : 0;

    return {
      totalRevenue,
      totalOutstanding,
      unpaidCount,
      totalPipeline,
      overdueInvoices,
      overdueTotal,
      paidInvoices,
      collectionRate,
      revenueData,
      cumulativeData,
      pipelineByStatus,
      jobTypeData,
      agingBuckets,
    };
  }, [invoices, jobs]);
}
