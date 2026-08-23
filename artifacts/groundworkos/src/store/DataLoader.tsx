import { useEffect } from "react";
import {
  useGetClients,
  useGetJobs,
  useGetQuotes,
  useGetInvoices,
  useGetSubcontractors,
  useGetDocuments,
  useGetSchedule,
  useGetPlant,
  useGetRateBook,
} from "@workspace/api-client-react";
import { useApp } from "./AppContext";
import {
  toClient,
  toJob,
  toQuote,
  toInvoice,
  toSubcontractor,
  toDocument,
  toScheduleEntry,
  toPlant,
  toTimesheet,
  toPurchaseOrder,
} from "../lib/apiTransforms";
import type { CISReturn } from "../types";
import { toast } from "sonner";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

async function loadRows(
  path: string,
  label: string,
): Promise<Record<string, unknown>[] | null> {
  try {
    const res = await fetch(`${BASE}${path}`);
    // 401/403 mean the current role isn't permitted this dataset (e.g. a foreman
    // hitting a manager-gated endpoint) — expected, so skip silently.
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : null;
  } catch (err) {
    console.error(`Failed to load ${label}:`, err);
    toast.error(`Couldn't load ${label}`, { id: "dataload-error" });
    return null;
  }
}

function mapCisReturn(row: Record<string, unknown>, idx: number): CISReturn {
  const period = (row.period as string | null) ?? "";
  const taxMonth = period ? period.slice(0, 7) : "";
  return {
    id: `cis-${idx}-${taxMonth}`,
    tax_month: taxMonth,
    subcontractor_id: "",
    subcontractor_name: (row.company_name as string) ?? "—",
    utr: (row.utr_number as string | null) ?? null,
    gross_payment: Number(row.gross_payment ?? 0),
    deduction_rate: Number(row.cis_deduction_rate ?? 0),
    deduction_amount: Number(row.cis_deducted ?? 0),
    net_payment: Number(row.net_payment ?? 0),
    submitted: false,
    submitted_at: null,
  };
}

export function DataLoader() {
  const { dispatch } = useApp();

  const { data: clients, isLoading: clientsLoading } = useGetClients();
  const { data: jobs, isLoading: jobsLoading } = useGetJobs();
  const { data: quotes, isLoading: quotesLoading } = useGetQuotes();
  const { data: invoices, isLoading: invoicesLoading } = useGetInvoices();
  const { data: subcontractors } = useGetSubcontractors();
  const { data: documents } = useGetDocuments();
  const { data: schedule } = useGetSchedule();
  const { data: plant } = useGetPlant();
  const { data: rateBook } = useGetRateBook();

  useEffect(() => {
    if (clients)
      dispatch({ type: "INIT_CLIENTS", clients: clients.map(toClient) });
  }, [clients, dispatch]);

  useEffect(() => {
    if (jobs) dispatch({ type: "INIT_JOBS", jobs: jobs.map(toJob) });
  }, [jobs, dispatch]);

  useEffect(() => {
    if (quotes) dispatch({ type: "INIT_QUOTES", quotes: quotes.map(toQuote) });
  }, [quotes, dispatch]);

  useEffect(() => {
    if (invoices)
      dispatch({ type: "INIT_INVOICES", invoices: invoices.map(toInvoice) });
  }, [invoices, dispatch]);

  useEffect(() => {
    if (subcontractors)
      dispatch({
        type: "INIT_SUBCONTRACTORS",
        subcontractors: subcontractors.map(toSubcontractor),
      });
  }, [subcontractors, dispatch]);

  useEffect(() => {
    if (documents)
      dispatch({
        type: "INIT_DOCUMENTS",
        documents: documents.map(toDocument),
      });
  }, [documents, dispatch]);

  useEffect(() => {
    if (schedule)
      dispatch({
        type: "INIT_SCHEDULE",
        schedule: schedule.map(toScheduleEntry),
      });
  }, [schedule, dispatch]);

  useEffect(() => {
    if (plant) dispatch({ type: "INIT_PLANT", plant: plant.map(toPlant) });
  }, [plant, dispatch]);

  useEffect(() => {
    if (rateBook) dispatch({ type: "INIT_RATE_BOOK", rateBook });
  }, [rateBook, dispatch]);

  useEffect(() => {
    if (!clientsLoading && !jobsLoading && !quotesLoading && !invoicesLoading) {
      dispatch({ type: "SET_LOADED" });
    }
  }, [clientsLoading, jobsLoading, quotesLoading, invoicesLoading, dispatch]);

  useEffect(() => {
    loadRows("/api/purchase-orders", "purchase orders").then((rows) => {
      if (rows)
        dispatch({
          type: "INIT_PURCHASE_ORDERS",
          purchaseOrders: rows.map(toPurchaseOrder),
        });
    });
  }, [dispatch]);

  useEffect(() => {
    loadRows("/api/timesheets", "timesheets").then((rows) => {
      if (rows)
        dispatch({
          type: "INIT_TIMESHEETS",
          timesheets: rows.map(toTimesheet),
        });
    });
  }, [dispatch]);

  useEffect(() => {
    loadRows("/api/cis/returns", "CIS returns").then((rows) => {
      if (rows)
        dispatch({
          type: "INIT_CIS_RETURNS",
          cisReturns: rows.map(mapCisReturn),
        });
    });
  }, [dispatch]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/settings/company`);
        if (res.status === 401 || res.status === 403) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Only merge a real settings object. A non-200 body is often
        // { error: ... }, which must not be treated as settings.
        if (data && typeof data === "object" && !Array.isArray(data)) {
          dispatch({ type: "INIT_SETTINGS", settings: data });
        }
      } catch (err) {
        console.error("Failed to load company settings:", err);
        toast.error("Couldn't load company settings", { id: "dataload-error" });
      }
    })();
  }, [dispatch]);

  return null;
}
