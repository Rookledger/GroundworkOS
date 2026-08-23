export type JobStatus =
  | "enquiry"
  | "quoted"
  | "active"
  | "on_hold"
  | "complete"
  | "cancelled";
export type JobType =
  | "drainage"
  | "foundations"
  | "excavation"
  | "kerbing"
  | "sewers"
  | "reinstatement"
  | "piling"
  | "subbase"
  | "utilities"
  | "groundworks";

export interface Job {
  id: string;
  job_number: string;
  title: string;
  client_id: string | null;
  client?: { company_name: string } | null;
  type: JobType | null;
  site_address: string | null;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  status: JobStatus;
  progress_percent: number;
  description: string | null;
  created_at: string;
  foreman: string | null;
  crew_count: number | null;
  nrswa_required: boolean;
  permit_number: string | null;
}

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface Quote {
  id: string;
  quote_number: string;
  client_id: string | null;
  client?: { company_name: string } | null;
  job_id: string | null;
  title: string | null;
  status: QuoteStatus;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  valid_until: string | null;
  notes: string | null;
  line_items: LineItem[];
  created_at: string;
  sent_at: string | null;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "credited";

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  client?: { company_name: string } | null;
  job_id: string | null;
  job?: { title: string } | null;
  quote_id: string | null;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  issued_date: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  cis_deduction: number | null;
}

export interface Client {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  vat_number: string | null;
  notes: string | null;
  created_at: string;
  total_jobs: number;
  total_value: number;
}

export type CISStatus = "gross" | "net" | "unmatched" | "unverified";

export interface Subcontractor {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  utr_number: string | null;
  cis_status: CISStatus;
  cis_deduction_rate: number;
  trade: string | null;
  nrswa_card_number: string | null;
  nrswa_expiry: string | null;
  public_liability_expiry: string | null;
  cscs_card_expiry: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  active: boolean;
}

export type DocumentType =
  | "rams"
  | "insurance"
  | "certification"
  | "permit"
  | "compliance"
  | "contract"
  | "other";
export type DocumentStatus = "valid" | "expiring_soon" | "expired" | "pending";
export type DocumentRelatedTo = "company" | "job" | "subcontractor" | "plant";

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  status: DocumentStatus;
  expiry_date: string | null;
  issued_date: string | null;
  related_to: DocumentRelatedTo;
  related_id: string | null;
  related_name: string | null;
  notes: string | null;
  file_path: string | null;
  created_at: string;
}

export interface ScheduleEntry {
  id: string;
  job_id: string | null;
  job?: {
    job_number: string;
    title: string;
    client: { company_name: string } | null;
  } | null;
  title: string;
  start_datetime: string;
  end_datetime: string;
  crew_count: number;
  plant_assigned: string | null;
  foreman: string | null;
  notes: string | null;
  type: "site_work" | "delivery" | "inspection" | "meeting" | "other";
}

export type PlantStatus =
  | "available"
  | "on_site"
  | "maintenance"
  | "hired_in"
  | "disposed";

export interface Plant {
  id: string;
  name: string;
  registration: string | null;
  category: string;
  make: string | null;
  model: string | null;
  year: number | null;
  status: PlantStatus;
  current_job_id: string | null;
  current_job?: { title: string } | null;
  service_due: string | null;
  mot_due: string | null;
  thorough_exam_due: string | null;
  notes: string | null;
  daily_rate: number | null;
  owned: boolean;
}

export interface RateBookEntry {
  id: string;
  category: string;
  description: string;
  unit: string;
  labour_rate: number;
  material_rate: number;
  plant_rate: number;
  total_rate: number;
  notes: string | null;
}

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "invoiced";

export interface PurchaseOrder {
  id: string;
  po_number: string;
  job_id: string | null;
  job_number: string | null;
  job_title: string | null;
  supplier: string;
  description: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  status: PurchaseOrderStatus;
  order_date: string;
  expected_delivery: string | null;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Timesheet {
  id: string;
  job_id: string | null;
  job_number: string | null;
  job_title: string | null;
  worker_name: string;
  work_date: string;
  hours_worked: number;
  day_rate: number | null;
  cost: number | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CISReturn {
  id: string;
  tax_month: string;
  subcontractor_id: string;
  subcontractor_name: string;
  utr: string | null;
  gross_payment: number;
  deduction_rate: number;
  deduction_amount: number;
  net_payment: number;
  submitted: boolean;
  submitted_at: string | null;
}
