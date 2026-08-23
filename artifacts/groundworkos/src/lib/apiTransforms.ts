import type {
  ClientRecord,
  JobRecord,
  QuoteRecord,
  InvoiceRecord,
  SubcontractorRecord,
  DocumentRecord,
  ScheduleEntryRecord,
  PlantRecord,
  RateBookRecord,
} from "@workspace/api-client-react";
import type {
  Client,
  Job,
  Quote,
  Invoice,
  Subcontractor,
  Document,
  ScheduleEntry,
  Plant,
  RateBookEntry,
  Timesheet,
  PurchaseOrder,
} from "../types";

export function toPurchaseOrder(r: Record<string, any>): PurchaseOrder {
  return {
    id: r.id,
    po_number: r.poNumber,
    job_id: r.jobId ?? null,
    job_number: r.jobNumber ?? null,
    job_title: r.jobTitle ?? null,
    supplier: r.supplier,
    description: r.description,
    amount: Number(r.amount ?? 0),
    vat_amount: Number(r.vatAmount ?? 0),
    total_amount: Number(r.totalAmount ?? 0),
    status: r.status as PurchaseOrder["status"],
    order_date: r.orderDate,
    expected_delivery: r.expectedDelivery ?? null,
    delivery_date: r.deliveryDate ?? null,
    notes: r.notes ?? null,
    created_at: r.createdAt,
  };
}

export function toTimesheet(r: Record<string, any>): Timesheet {
  return {
    id: r.id,
    job_id: r.jobId ?? null,
    job_number: r.jobNumber ?? null,
    job_title: r.jobTitle ?? null,
    worker_name: r.workerName,
    work_date: r.workDate,
    hours_worked: Number(r.hoursWorked ?? 8),
    day_rate: r.dayRate != null ? Number(r.dayRate) : null,
    cost: r.cost != null ? Number(r.cost) : null,
    description: r.description ?? null,
    created_by: r.createdBy ?? null,
    created_at: r.createdAt,
  };
}

export function toClient(r: ClientRecord): Client {
  return {
    id: r.id,
    company_name: r.companyName,
    contact_name: r.contactName ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    address: r.address ?? null,
    vat_number: r.vatNumber ?? null,
    notes: r.notes ?? null,
    created_at: r.createdAt,
    total_jobs: r.totalJobs ?? 0,
    total_value: r.totalValue ?? 0,
  };
}

export function toJob(r: JobRecord): Job {
  return {
    id: r.id,
    job_number: r.jobNumber,
    title: r.title,
    client_id: r.clientId ?? null,
    client: r.clientName ? { company_name: r.clientName } : null,
    type: (r.type as Job["type"]) ?? null,
    site_address: r.siteAddress ?? null,
    value: r.value ?? null,
    start_date: r.startDate ?? null,
    end_date: r.endDate ?? null,
    status: r.status as Job["status"],
    progress_percent: r.progressPercent,
    description: r.description ?? null,
    created_at: r.createdAt,
    foreman: r.foreman ?? null,
    crew_count: r.crewCount ?? null,
    nrswa_required: r.nrswaRequired,
    permit_number: r.permitNumber ?? null,
  };
}

export function toQuote(r: QuoteRecord): Quote {
  return {
    id: r.id,
    quote_number: r.quoteNumber,
    client_id: r.clientId ?? null,
    client: r.clientName ? { company_name: r.clientName } : null,
    job_id: r.jobId ?? null,
    title: r.title ?? null,
    status: r.status as Quote["status"],
    subtotal: r.subtotal,
    vat_amount: r.vatAmount,
    total_amount: r.totalAmount,
    valid_until: r.validUntil ?? null,
    notes: r.notes ?? null,
    created_at: r.createdAt,
    sent_at: r.sentAt ?? null,
    line_items: (r.lineItems ?? []).map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_price: li.unitPrice,
      total: li.total,
    })),
  };
}

export function toInvoice(r: InvoiceRecord): Invoice {
  return {
    id: r.id,
    invoice_number: r.invoiceNumber,
    client_id: r.clientId ?? null,
    client: r.clientName ? { company_name: r.clientName } : null,
    job_id: r.jobId ?? null,
    job: r.jobTitle ? { title: r.jobTitle } : null,
    quote_id: r.quoteId ?? null,
    subtotal: r.subtotal,
    vat_amount: r.vatAmount,
    total_amount: r.totalAmount,
    status: r.status as Invoice["status"],
    issued_date: r.issuedDate,
    due_date: r.dueDate ?? null,
    paid_at: r.paidAt ?? null,
    notes: r.notes ?? null,
    created_at: r.createdAt,
    cis_deduction: r.cisDeduction ?? null,
  };
}

export function toSubcontractor(r: SubcontractorRecord): Subcontractor {
  return {
    id: r.id,
    company_name: r.companyName,
    contact_name: r.contactName ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    utr_number: r.utrNumber ?? null,
    cis_status: r.cisStatus as Subcontractor["cis_status"],
    cis_deduction_rate: r.cisDeductionRate,
    trade: r.trade ?? null,
    nrswa_card_number: r.nrswaCardNumber ?? null,
    nrswa_expiry: r.nrswaExpiry ?? null,
    public_liability_expiry: r.publicLiabilityExpiry ?? null,
    cscs_card_expiry: r.cscsCardExpiry ?? null,
    address: r.address ?? null,
    notes: r.notes ?? null,
    created_at: r.createdAt,
    active: r.active,
  };
}

export function toDocument(r: DocumentRecord): Document {
  return {
    id: r.id,
    name: r.name,
    type: r.type as Document["type"],
    status: r.status as Document["status"],
    expiry_date: r.expiryDate ?? null,
    issued_date: r.issuedDate ?? null,
    related_to: r.relatedTo as Document["related_to"],
    related_id: r.relatedId ?? null,
    related_name: r.relatedName ?? null,
    notes: r.notes ?? null,
    file_path: (r as any).filePath ?? null,
    created_at: r.createdAt,
  };
}

export function toScheduleEntry(r: ScheduleEntryRecord): ScheduleEntry {
  return {
    id: r.id,
    job_id: r.jobId ?? null,
    job:
      r.jobNumber && r.jobTitle
        ? {
            job_number: r.jobNumber,
            title: r.jobTitle,
            client: r.clientName ? { company_name: r.clientName } : null,
          }
        : null,
    title: r.title,
    start_datetime: r.startDatetime,
    end_datetime: r.endDatetime,
    crew_count: r.crewCount,
    plant_assigned: r.plantAssigned ?? null,
    foreman: r.foreman ?? null,
    notes: r.notes ?? null,
    type: r.type as ScheduleEntry["type"],
  };
}

export function toPlant(r: PlantRecord): Plant {
  return {
    id: r.id,
    name: r.name,
    registration: r.registration ?? null,
    category: r.category,
    make: r.make ?? null,
    model: r.model ?? null,
    year: r.year ?? null,
    status: r.status as Plant["status"],
    current_job_id: r.currentJobId ?? null,
    current_job: r.currentJobTitle ? { title: r.currentJobTitle } : null,
    service_due: r.serviceDue ?? null,
    mot_due: r.motDue ?? null,
    thorough_exam_due: r.thoroughExamDue ?? null,
    notes: r.notes ?? null,
    daily_rate: r.dailyRate ?? null,
    owned: r.owned,
  };
}

export function toRateBookEntry(r: RateBookRecord): RateBookEntry {
  return {
    id: r.id,
    category: r.category,
    description: r.description,
    unit: r.unit,
    labour_rate: r.labourRate,
    material_rate: r.materialRate,
    plant_rate: r.plantRate,
    total_rate: r.totalRate,
    notes: r.notes ?? null,
  };
}
