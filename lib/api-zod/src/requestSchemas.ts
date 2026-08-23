/**
 * Hand-written request-body validation schemas.
 *
 * Unlike ./generated/api.ts (orval-generated from the OpenAPI spec, and not
 * always in sync with the live Drizzle schema/route behavior), these schemas
 * describe exactly what a client is allowed to send in the body of a
 * mutating (POST/PUT/PATCH) request. They intentionally:
 *  - omit server-generated fields (id, sequence numbers like jobNumber/
 *    invoiceNumber/quoteNumber/poNumber)
 *  - omit server-computed/enrichment-only fields (totals, VAT, CIS
 *    deduction, joined-in names like clientName/jobTitle/currentJobTitle)
 *  - use `.strict()` so unrecognized/extra fields are rejected with a 400
 *    instead of being silently ignored or (worse) written to the database.
 */
import { z } from "zod";

export const CreateClientInput = z
  .object({
    companyName: z.string(),
    contactName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    vatNumber: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const UpdateClientInput = z
  .object({
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    vatNumber: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const CreateJobInput = z
  .object({
    title: z.string(),
    clientId: z.string().optional(),
    type: z.string().optional(),
    siteAddress: z.string().optional(),
    value: z.number().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
    progressPercent: z.number().optional(),
    description: z.string().optional(),
    foreman: z.string().optional(),
    crewCount: z.number().optional(),
    nrswaRequired: z.boolean().optional(),
    permitNumber: z.string().optional(),
  })
  .strict();

export const UpdateJobInput = z
  .object({
    title: z.string().optional(),
    clientId: z.string().optional(),
    type: z.string().optional(),
    siteAddress: z.string().optional(),
    value: z.number().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
    progressPercent: z.number().optional(),
    description: z.string().optional(),
    foreman: z.string().optional(),
    crewCount: z.number().optional(),
    nrswaRequired: z.boolean().optional(),
    permitNumber: z.string().optional(),
  })
  .strict();

// Line items are always re-priced server-side from quantity * unitPrice, so
// `id`, `quoteId` and `total` are never accepted from the client.
export const QuoteLineItemInput = z
  .object({
    description: z.string(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    unitPrice: z.number().optional(),
  })
  .strict();

export const CreateQuoteInput = z
  .object({
    clientId: z.string().optional(),
    jobId: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
    validUntil: z.string().optional(),
    notes: z.string().optional(),
    lineItems: z.array(QuoteLineItemInput).optional(),
  })
  .strict();

export const UpdateQuoteInput = z
  .object({
    clientId: z.string().optional(),
    jobId: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
    validUntil: z.string().optional(),
    notes: z.string().optional(),
    sentAt: z.string().optional(),
    lineItems: z.array(QuoteLineItemInput).optional(),
  })
  .strict();

// subtotal/vatAmount/totalAmount/cisDeduction are always recomputed
// server-side (see computeFinancials in routes/invoices.ts) and must never
// be accepted from the client.
export const CreateInvoiceInput = z
  .object({
    clientId: z.string().optional(),
    jobId: z.string().optional(),
    quoteId: z.string().optional(),
    subcontractorId: z.string().optional(),
    subtotal: z.number().optional(),
    status: z.string().optional(),
    issuedDate: z.string(),
    dueDate: z.string().optional(),
    paidAt: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const UpdateInvoiceInput = z
  .object({
    clientId: z.string().optional(),
    jobId: z.string().optional(),
    quoteId: z.string().optional(),
    subcontractorId: z.string().optional(),
    subtotal: z.number().optional(),
    status: z.string().optional(),
    issuedDate: z.string().optional(),
    dueDate: z.string().optional(),
    paidAt: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

// Note: routes/subcontractors.ts additionally restricts cisStatus,
// cisDeductionRate and utrNumber to admin-only *after* this shape/type
// validation runs — that RBAC filtering is unchanged by this schema.
export const CreateSubcontractorInput = z
  .object({
    companyName: z.string(),
    contactName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    utrNumber: z.string().optional(),
    cisStatus: z.string().optional(),
    cisDeductionRate: z.number().optional(),
    trade: z.string().optional(),
    nrswaCardNumber: z.string().optional(),
    nrswaExpiry: z.string().optional(),
    publicLiabilityExpiry: z.string().optional(),
    cscsCardExpiry: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const UpdateSubcontractorInput = z
  .object({
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    utrNumber: z.string().optional(),
    cisStatus: z.string().optional(),
    cisDeductionRate: z.number().optional(),
    trade: z.string().optional(),
    nrswaCardNumber: z.string().optional(),
    nrswaExpiry: z.string().optional(),
    publicLiabilityExpiry: z.string().optional(),
    cscsCardExpiry: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  })
  .strict();

// `status` is always server-computed on create (see computeDocStatus in
// routes/documents.ts), so it is intentionally omitted from the create
// input. On update it is only recomputed when expiryDate changes, so it
// remains accepted there to preserve existing passthrough behavior.
export const CreateDocumentInput = z
  .object({
    name: z.string(),
    type: z.string(),
    expiryDate: z.string().optional(),
    issuedDate: z.string().optional(),
    relatedTo: z.string().optional(),
    relatedId: z.string().optional(),
    relatedName: z.string().optional(),
    notes: z.string().optional(),
    filePath: z.string().optional(),
  })
  .strict();

export const UpdateDocumentInput = z
  .object({
    name: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    expiryDate: z.string().optional(),
    issuedDate: z.string().optional(),
    relatedTo: z.string().optional(),
    relatedId: z.string().optional(),
    relatedName: z.string().optional(),
    notes: z.string().optional(),
    filePath: z.string().optional(),
  })
  .strict();

export const CreatePlantInput = z
  .object({
    name: z.string(),
    registration: z.string().optional(),
    category: z.string(),
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().optional(),
    status: z.string().optional(),
    currentJobId: z.string().optional(),
    serviceDue: z.string().optional(),
    motDue: z.string().optional(),
    thoroughExamDue: z.string().optional(),
    notes: z.string().optional(),
    dailyRate: z.number().optional(),
    owned: z.boolean().optional(),
  })
  .strict();

export const UpdatePlantInput = z
  .object({
    name: z.string().optional(),
    registration: z.string().optional(),
    category: z.string().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().optional(),
    status: z.string().optional(),
    currentJobId: z.string().optional(),
    serviceDue: z.string().optional(),
    motDue: z.string().optional(),
    thoroughExamDue: z.string().optional(),
    notes: z.string().optional(),
    dailyRate: z.number().optional(),
    owned: z.boolean().optional(),
  })
  .strict();

// `cost` is always derived server-side from hoursWorked/dayRate, so it is
// never accepted from the client on either create or update.
export const CreateTimesheetInput = z
  .object({
    jobId: z.string().optional(),
    workerName: z.string(),
    workDate: z.string(),
    hoursWorked: z.number().optional(),
    dayRate: z.number().optional(),
    description: z.string().optional(),
    createdBy: z.string().optional(),
  })
  .strict();

export const UpdateTimesheetInput = z
  .object({
    jobId: z.string().optional(),
    workerName: z.string().optional(),
    workDate: z.string().optional(),
    hoursWorked: z.number().optional(),
    dayRate: z.number().optional(),
    description: z.string().optional(),
    createdBy: z.string().optional(),
  })
  .strict();

export const CreatePurchaseOrderInput = z
  .object({
    jobId: z.string().optional(),
    supplier: z.string(),
    description: z.string(),
    amount: z.number().optional(),
    vatAmount: z.number().optional(),
    totalAmount: z.number().optional(),
    status: z.string().optional(),
    orderDate: z.string(),
    expectedDelivery: z.string().optional(),
    deliveryDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const UpdatePurchaseOrderInput = z
  .object({
    jobId: z.string().optional(),
    supplier: z.string().optional(),
    description: z.string().optional(),
    amount: z.number().optional(),
    vatAmount: z.number().optional(),
    totalAmount: z.number().optional(),
    status: z.string().optional(),
    orderDate: z.string().optional(),
    expectedDelivery: z.string().optional(),
    deliveryDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const CreateRateBookInput = z
  .object({
    category: z.string(),
    description: z.string(),
    unit: z.string(),
    labourRate: z.number().optional(),
    materialRate: z.number().optional(),
    plantRate: z.number().optional(),
    totalRate: z.number().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const UpdateRateBookInput = z
  .object({
    category: z.string().optional(),
    description: z.string().optional(),
    unit: z.string().optional(),
    labourRate: z.number().optional(),
    materialRate: z.number().optional(),
    plantRate: z.number().optional(),
    totalRate: z.number().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const CreateScheduleInput = z
  .object({
    jobId: z.string().optional(),
    title: z.string(),
    startDatetime: z.string(),
    endDatetime: z.string(),
    crewCount: z.number().optional(),
    plantAssigned: z.string().optional(),
    foreman: z.string().optional(),
    notes: z.string().optional(),
    type: z.string().optional(),
  })
  .strict();

export const UpdateScheduleInput = z
  .object({
    jobId: z.string().optional(),
    title: z.string().optional(),
    startDatetime: z.string().optional(),
    endDatetime: z.string().optional(),
    crewCount: z.number().optional(),
    plantAssigned: z.string().optional(),
    foreman: z.string().optional(),
    notes: z.string().optional(),
    type: z.string().optional(),
  })
  .strict();

// The Settings page always PUTs the full merged CompanySettings object
// (see SettingsPage.tsx's `save()` helper), but every field is kept
// optional here defensively; unrecognized keys are still rejected.
export const CompanySettingsInput = z
  .object({
    companyName: z.string().optional(),
    companyNumber: z.string().optional(),
    vatNumber: z.string().optional(),
    utrNumber: z.string().optional(),
    cisReference: z.string().optional(),
    address: z.string().optional(),
    invoicePrefix: z.string().optional(),
    quotePrefix: z.string().optional(),
    jobPrefix: z.string().optional(),
    paymentTerms: z.string().optional(),
    streetWorksLicenceRef: z.string().optional(),
    defaultPermitAuthority: z.string().optional(),
    bankName: z.string().optional(),
    sortCode: z.string().optional(),
    accountNumber: z.string().optional(),
    taxYearStart: z.string().optional(),
    filingReminderDays: z.string().optional(),
  })
  .strict();
