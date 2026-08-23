import { createContext, useContext, useReducer, type ReactNode } from "react";
import type {
  Job,
  Quote,
  Invoice,
  Client,
  Subcontractor,
  Document,
  ScheduleEntry,
  Plant,
  CISReturn,
  Timesheet,
  PurchaseOrder,
} from "../types";

export interface CompanySettings {
  companyName: string;
  companyNumber: string;
  vatNumber: string;
  utrNumber: string;
  cisReference: string;
  address: string;
  invoicePrefix: string;
  quotePrefix: string;
  jobPrefix: string;
  paymentTerms: string;
  streetWorksLicenceRef: string;
  defaultPermitAuthority: string;
  bankName: string;
  sortCode: string;
  accountNumber: string;
  taxYearStart: string;
  filingReminderDays: string;
}

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: "GroundworkOS Ltd",
  companyNumber: "",
  vatNumber: "",
  utrNumber: "",
  cisReference: "",
  address: "",
  invoicePrefix: "INV",
  quotePrefix: "QT",
  jobPrefix: "GW",
  paymentTerms: "30 days",
  streetWorksLicenceRef: "",
  defaultPermitAuthority: "",
  bankName: "",
  sortCode: "",
  accountNumber: "",
  taxYearStart: "6 April",
  filingReminderDays: "5",
};

export interface AppState {
  jobs: Job[];
  quotes: Quote[];
  invoices: Invoice[];
  clients: Client[];
  subcontractors: Subcontractor[];
  documents: Document[];
  schedule: ScheduleEntry[];
  plant: Plant[];
  cisReturns: CISReturn[];
  rateBook: any[];
  timesheets: Timesheet[];
  purchaseOrders: PurchaseOrder[];
  settings: CompanySettings;
  settingsLoaded: boolean;
  isLoading: boolean;
}

export type AppAction =
  | { type: "SET_LOADED" }
  | { type: "INIT_JOBS"; jobs: Job[] }
  | { type: "INIT_QUOTES"; quotes: Quote[] }
  | { type: "INIT_INVOICES"; invoices: Invoice[] }
  | { type: "INIT_CLIENTS"; clients: Client[] }
  | { type: "INIT_SUBCONTRACTORS"; subcontractors: Subcontractor[] }
  | { type: "INIT_DOCUMENTS"; documents: Document[] }
  | { type: "INIT_SCHEDULE"; schedule: ScheduleEntry[] }
  | { type: "INIT_PLANT"; plant: Plant[] }
  | { type: "INIT_RATE_BOOK"; rateBook: any[] }
  | { type: "INIT_CIS_RETURNS"; cisReturns: CISReturn[] }
  | { type: "INIT_TIMESHEETS"; timesheets: Timesheet[] }
  | { type: "INIT_SETTINGS"; settings: Partial<CompanySettings> }
  | { type: "ADD_TIMESHEET"; timesheet: Timesheet }
  | { type: "UPDATE_TIMESHEET"; id: string; updates: Partial<Timesheet> }
  | { type: "REMOVE_TIMESHEET"; id: string }
  | { type: "INIT_PURCHASE_ORDERS"; purchaseOrders: PurchaseOrder[] }
  | { type: "ADD_PURCHASE_ORDER"; order: PurchaseOrder }
  | {
      type: "UPDATE_PURCHASE_ORDER";
      id: string;
      updates: Partial<PurchaseOrder>;
    }
  | { type: "REMOVE_PURCHASE_ORDER"; id: string }
  | { type: "ADD_JOB"; job: Job }
  | { type: "UPDATE_JOB"; id: string; updates: Partial<Job> }
  | { type: "REMOVE_JOB"; id: string }
  | { type: "ADD_QUOTE"; quote: Quote }
  | { type: "UPDATE_QUOTE"; id: string; updates: Partial<Quote> }
  | { type: "REMOVE_QUOTE"; id: string }
  | { type: "ADD_INVOICE"; invoice: Invoice }
  | { type: "UPDATE_INVOICE"; id: string; updates: Partial<Invoice> }
  | { type: "REMOVE_INVOICE"; id: string }
  | { type: "ADD_CLIENT"; client: Client }
  | { type: "UPDATE_CLIENT"; id: string; updates: Partial<Client> }
  | { type: "REMOVE_CLIENT"; id: string }
  | { type: "ADD_SUBCONTRACTOR"; sub: Subcontractor }
  | {
      type: "UPDATE_SUBCONTRACTOR";
      id: string;
      updates: Partial<Subcontractor>;
    }
  | { type: "REMOVE_SUBCONTRACTOR"; id: string }
  | { type: "ADD_DOCUMENT"; doc: Document }
  | { type: "UPDATE_DOCUMENT"; id: string; updates: Partial<Document> }
  | { type: "REMOVE_DOCUMENT"; id: string }
  | { type: "ADD_PLANT"; plant: Plant }
  | { type: "UPDATE_PLANT"; id: string; updates: Partial<Plant> }
  | { type: "REMOVE_PLANT"; id: string }
  | { type: "ADD_SCHEDULE"; entry: ScheduleEntry }
  | { type: "UPDATE_SCHEDULE"; id: string; updates: Partial<ScheduleEntry> }
  | { type: "REMOVE_SCHEDULE"; id: string };

const initialState: AppState = {
  jobs: [],
  quotes: [],
  invoices: [],
  clients: [],
  subcontractors: [],
  documents: [],
  schedule: [],
  plant: [],
  cisReturns: [],
  rateBook: [],
  timesheets: [],
  purchaseOrders: [],
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  isLoading: true,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_LOADED":
      return { ...state, isLoading: false };
    case "INIT_JOBS":
      return { ...state, jobs: action.jobs };
    case "INIT_QUOTES":
      return { ...state, quotes: action.quotes };
    case "INIT_INVOICES":
      return { ...state, invoices: action.invoices };
    case "INIT_CLIENTS":
      return { ...state, clients: action.clients };
    case "INIT_SUBCONTRACTORS":
      return { ...state, subcontractors: action.subcontractors };
    case "INIT_DOCUMENTS":
      return { ...state, documents: action.documents };
    case "INIT_SCHEDULE":
      return { ...state, schedule: action.schedule };
    case "INIT_PLANT":
      return { ...state, plant: action.plant };
    case "INIT_RATE_BOOK":
      return { ...state, rateBook: action.rateBook };
    case "INIT_CIS_RETURNS":
      return { ...state, cisReturns: action.cisReturns };
    case "INIT_TIMESHEETS":
      return { ...state, timesheets: action.timesheets };
    case "INIT_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
        settingsLoaded: true,
      };
    case "ADD_TIMESHEET":
      return { ...state, timesheets: [action.timesheet, ...state.timesheets] };
    case "UPDATE_TIMESHEET":
      return {
        ...state,
        timesheets: state.timesheets.map((t) =>
          t.id === action.id ? { ...t, ...action.updates } : t,
        ),
      };
    case "REMOVE_TIMESHEET":
      return {
        ...state,
        timesheets: state.timesheets.filter((t) => t.id !== action.id),
      };
    case "INIT_PURCHASE_ORDERS":
      return { ...state, purchaseOrders: action.purchaseOrders };
    case "ADD_PURCHASE_ORDER":
      return {
        ...state,
        purchaseOrders: [action.order, ...state.purchaseOrders],
      };
    case "UPDATE_PURCHASE_ORDER":
      return {
        ...state,
        purchaseOrders: state.purchaseOrders.map((o) =>
          o.id === action.id ? { ...o, ...action.updates } : o,
        ),
      };
    case "REMOVE_PURCHASE_ORDER":
      return {
        ...state,
        purchaseOrders: state.purchaseOrders.filter((o) => o.id !== action.id),
      };
    case "ADD_JOB":
      return { ...state, jobs: [action.job, ...state.jobs] };
    case "UPDATE_JOB":
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.id ? { ...j, ...action.updates } : j,
        ),
      };
    case "REMOVE_JOB":
      return { ...state, jobs: state.jobs.filter((j) => j.id !== action.id) };
    case "ADD_QUOTE":
      return { ...state, quotes: [action.quote, ...state.quotes] };
    case "UPDATE_QUOTE":
      return {
        ...state,
        quotes: state.quotes.map((q) =>
          q.id === action.id ? { ...q, ...action.updates } : q,
        ),
      };
    case "REMOVE_QUOTE":
      return {
        ...state,
        quotes: state.quotes.filter((q) => q.id !== action.id),
      };
    case "ADD_INVOICE":
      return { ...state, invoices: [action.invoice, ...state.invoices] };
    case "UPDATE_INVOICE":
      return {
        ...state,
        invoices: state.invoices.map((i) =>
          i.id === action.id ? { ...i, ...action.updates } : i,
        ),
      };
    case "REMOVE_INVOICE":
      return {
        ...state,
        invoices: state.invoices.filter((i) => i.id !== action.id),
      };
    case "ADD_CLIENT":
      return { ...state, clients: [action.client, ...state.clients] };
    case "UPDATE_CLIENT":
      return {
        ...state,
        clients: state.clients.map((c) =>
          c.id === action.id ? { ...c, ...action.updates } : c,
        ),
      };
    case "REMOVE_CLIENT":
      return {
        ...state,
        clients: state.clients.filter((c) => c.id !== action.id),
      };
    case "ADD_SUBCONTRACTOR":
      return {
        ...state,
        subcontractors: [action.sub, ...state.subcontractors],
      };
    case "UPDATE_SUBCONTRACTOR":
      return {
        ...state,
        subcontractors: state.subcontractors.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s,
        ),
      };
    case "REMOVE_SUBCONTRACTOR":
      return {
        ...state,
        subcontractors: state.subcontractors.filter((s) => s.id !== action.id),
      };
    case "ADD_DOCUMENT":
      return { ...state, documents: [action.doc, ...state.documents] };
    case "UPDATE_DOCUMENT":
      return {
        ...state,
        documents: state.documents.map((d) =>
          d.id === action.id ? { ...d, ...action.updates } : d,
        ),
      };
    case "REMOVE_DOCUMENT":
      return {
        ...state,
        documents: state.documents.filter((d) => d.id !== action.id),
      };
    case "ADD_PLANT":
      return { ...state, plant: [action.plant, ...state.plant] };
    case "UPDATE_PLANT":
      return {
        ...state,
        plant: state.plant.map((p) =>
          p.id === action.id ? { ...p, ...action.updates } : p,
        ),
      };
    case "REMOVE_PLANT":
      return { ...state, plant: state.plant.filter((p) => p.id !== action.id) };
    case "ADD_SCHEDULE":
      return { ...state, schedule: [action.entry, ...state.schedule] };
    case "UPDATE_SCHEDULE":
      return {
        ...state,
        schedule: state.schedule.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s,
        ),
      };
    case "REMOVE_SCHEDULE":
      return {
        ...state,
        schedule: state.schedule.filter((s) => s.id !== action.id),
      };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
