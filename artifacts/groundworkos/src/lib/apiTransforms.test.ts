import { describe, expect, it } from "vitest";
import {
  toClient,
  toDocument,
  toInvoice,
  toJob,
  toPlant,
  toPurchaseOrder,
  toQuote,
  toRateBookEntry,
  toScheduleEntry,
  toSubcontractor,
  toTimesheet,
} from "./apiTransforms";

// The API/DB layer speaks camelCase; the frontend's types.ts speaks
// snake_case throughout. apiTransforms.ts is the only bridge between them.
// A field added to the schema without a matching entry here silently never
// reaches the frontend, which the README flags as a real past bug source —
// so every entity's full field mapping is round-tripped here.

describe("toClient", () => {
  it("maps every camelCase field to its snake_case counterpart", () => {
    const result = toClient({
      id: "client-1",
      companyName: "Acme Groundworks",
      contactName: "Jane Doe",
      email: "jane@acme.test",
      phone: "01234 567890",
      address: "1 Site Road",
      vatNumber: "GB123456789",
      notes: "Prefers email contact",
      createdAt: "2026-01-01T00:00:00Z",
      totalJobs: 4,
      totalValue: 12000,
    } as any);

    expect(result).toEqual({
      id: "client-1",
      company_name: "Acme Groundworks",
      contact_name: "Jane Doe",
      email: "jane@acme.test",
      phone: "01234 567890",
      address: "1 Site Road",
      vat_number: "GB123456789",
      notes: "Prefers email contact",
      created_at: "2026-01-01T00:00:00Z",
      total_jobs: 4,
      total_value: 12000,
    });
  });

  it("defaults nullable/optional fields when absent", () => {
    const result = toClient({
      id: "client-2",
      companyName: "Bare Ltd",
      createdAt: "2026-01-02T00:00:00Z",
    } as any);

    expect(result).toEqual({
      id: "client-2",
      company_name: "Bare Ltd",
      contact_name: null,
      email: null,
      phone: null,
      address: null,
      vat_number: null,
      notes: null,
      created_at: "2026-01-02T00:00:00Z",
      total_jobs: 0,
      total_value: 0,
    });
  });
});

describe("toJob", () => {
  it("maps every camelCase field to its snake_case counterpart", () => {
    const result = toJob({
      id: "job-1",
      jobNumber: "JOB-2026-001",
      title: "Drainage renewal",
      clientId: "client-1",
      clientName: "Acme Groundworks",
      type: "drainage",
      siteAddress: "1 Site Road",
      value: 5000,
      startDate: "2026-02-01",
      endDate: "2026-02-15",
      status: "active",
      progressPercent: 40,
      description: "Renew site drainage",
      createdAt: "2026-01-01T00:00:00Z",
      foreman: "Sam Foreman",
      crewCount: 3,
      nrswaRequired: true,
      permitNumber: "PN-99",
    } as any);

    expect(result).toEqual({
      id: "job-1",
      job_number: "JOB-2026-001",
      title: "Drainage renewal",
      client_id: "client-1",
      client: { company_name: "Acme Groundworks" },
      type: "drainage",
      site_address: "1 Site Road",
      value: 5000,
      start_date: "2026-02-01",
      end_date: "2026-02-15",
      status: "active",
      progress_percent: 40,
      description: "Renew site drainage",
      created_at: "2026-01-01T00:00:00Z",
      foreman: "Sam Foreman",
      crew_count: 3,
      nrswa_required: true,
      permit_number: "PN-99",
    });
  });

  it("defaults nullable fields and omits the client relation when clientName is absent", () => {
    const result = toJob({
      id: "job-2",
      jobNumber: "JOB-2026-002",
      title: "Bare job",
      status: "enquiry",
      progressPercent: 0,
      createdAt: "2026-01-02T00:00:00Z",
      nrswaRequired: false,
    } as any);

    expect(result).toEqual({
      id: "job-2",
      job_number: "JOB-2026-002",
      title: "Bare job",
      client_id: null,
      client: null,
      type: null,
      site_address: null,
      value: null,
      start_date: null,
      end_date: null,
      status: "enquiry",
      progress_percent: 0,
      description: null,
      created_at: "2026-01-02T00:00:00Z",
      foreman: null,
      crew_count: null,
      nrswa_required: false,
      permit_number: null,
    });
  });
});

describe("toQuote", () => {
  it("maps every camelCase field, including nested line items", () => {
    const result = toQuote({
      id: "quote-1",
      quoteNumber: "Q-2026-001",
      clientId: "client-1",
      clientName: "Acme Groundworks",
      jobId: "job-1",
      title: "Drainage quote",
      status: "sent",
      subtotal: 1000,
      vatAmount: 200,
      totalAmount: 1200,
      validUntil: "2026-03-01",
      notes: "Valid for 30 days",
      createdAt: "2026-01-01T00:00:00Z",
      sentAt: "2026-01-02T00:00:00Z",
      lineItems: [
        {
          id: "li-1",
          description: "Excavation",
          quantity: 10,
          unit: "m3",
          unitPrice: 50,
          total: 500,
        },
      ],
    } as any);

    expect(result).toEqual({
      id: "quote-1",
      quote_number: "Q-2026-001",
      client_id: "client-1",
      client: { company_name: "Acme Groundworks" },
      job_id: "job-1",
      title: "Drainage quote",
      status: "sent",
      subtotal: 1000,
      vat_amount: 200,
      total_amount: 1200,
      valid_until: "2026-03-01",
      notes: "Valid for 30 days",
      created_at: "2026-01-01T00:00:00Z",
      sent_at: "2026-01-02T00:00:00Z",
      line_items: [
        {
          id: "li-1",
          description: "Excavation",
          quantity: 10,
          unit: "m3",
          unit_price: 50,
          total: 500,
        },
      ],
    });
  });

  it("defaults line_items to an empty array when lineItems is absent", () => {
    const result = toQuote({
      id: "quote-2",
      quoteNumber: "Q-2026-002",
      status: "draft",
      subtotal: 0,
      vatAmount: 0,
      totalAmount: 0,
      createdAt: "2026-01-02T00:00:00Z",
    } as any);

    expect(result.line_items).toEqual([]);
    expect(result.client).toBeNull();
  });
});

describe("toInvoice", () => {
  it("maps every camelCase field to its snake_case counterpart", () => {
    const result = toInvoice({
      id: "invoice-1",
      invoiceNumber: "INV-2026-001",
      clientId: "client-1",
      clientName: "Acme Groundworks",
      jobId: "job-1",
      jobTitle: "Drainage renewal",
      quoteId: "quote-1",
      subtotal: 1000,
      vatAmount: 200,
      totalAmount: 1200,
      status: "paid",
      issuedDate: "2026-01-01",
      dueDate: "2026-01-31",
      paidAt: "2026-01-20T00:00:00Z",
      notes: "Paid on time",
      createdAt: "2026-01-01T00:00:00Z",
      cisDeduction: 200,
    } as any);

    expect(result).toEqual({
      id: "invoice-1",
      invoice_number: "INV-2026-001",
      client_id: "client-1",
      client: { company_name: "Acme Groundworks" },
      job_id: "job-1",
      job: { title: "Drainage renewal" },
      quote_id: "quote-1",
      subtotal: 1000,
      vat_amount: 200,
      total_amount: 1200,
      status: "paid",
      issued_date: "2026-01-01",
      due_date: "2026-01-31",
      paid_at: "2026-01-20T00:00:00Z",
      notes: "Paid on time",
      created_at: "2026-01-01T00:00:00Z",
      cis_deduction: 200,
    });
  });
});

describe("toSubcontractor", () => {
  it("maps every camelCase field to its snake_case counterpart", () => {
    const result = toSubcontractor({
      id: "sub-1",
      companyName: "Digger Bros",
      contactName: "Pat Digger",
      email: "pat@diggerbros.test",
      phone: "01234 111222",
      utrNumber: "1234567890",
      cisStatus: "gross",
      cisDeductionRate: 0,
      trade: "Excavation",
      nrswaCardNumber: "NR-1",
      nrswaExpiry: "2027-01-01",
      publicLiabilityExpiry: "2027-02-01",
      cscsCardExpiry: "2027-03-01",
      address: "2 Site Road",
      notes: "Reliable",
      createdAt: "2026-01-01T00:00:00Z",
      active: true,
    } as any);

    expect(result).toEqual({
      id: "sub-1",
      company_name: "Digger Bros",
      contact_name: "Pat Digger",
      email: "pat@diggerbros.test",
      phone: "01234 111222",
      utr_number: "1234567890",
      cis_status: "gross",
      cis_deduction_rate: 0,
      trade: "Excavation",
      nrswa_card_number: "NR-1",
      nrswa_expiry: "2027-01-01",
      public_liability_expiry: "2027-02-01",
      cscs_card_expiry: "2027-03-01",
      address: "2 Site Road",
      notes: "Reliable",
      created_at: "2026-01-01T00:00:00Z",
      active: true,
    });
  });
});

describe("toDocument", () => {
  it("maps every camelCase field to its snake_case counterpart", () => {
    const result = toDocument({
      id: "doc-1",
      name: "Public Liability Insurance",
      type: "insurance",
      status: "valid",
      expiryDate: "2027-01-01",
      issuedDate: "2026-01-01",
      relatedTo: "subcontractor",
      relatedId: "sub-1",
      relatedName: "Digger Bros",
      notes: "Renewed annually",
      filePath: "/uploads/doc-1.pdf",
      createdAt: "2026-01-01T00:00:00Z",
    } as any);

    expect(result).toEqual({
      id: "doc-1",
      name: "Public Liability Insurance",
      type: "insurance",
      status: "valid",
      expiry_date: "2027-01-01",
      issued_date: "2026-01-01",
      related_to: "subcontractor",
      related_id: "sub-1",
      related_name: "Digger Bros",
      notes: "Renewed annually",
      file_path: "/uploads/doc-1.pdf",
      created_at: "2026-01-01T00:00:00Z",
    });
  });
});

describe("toScheduleEntry", () => {
  it("maps every camelCase field, including the nested job/client relation", () => {
    const result = toScheduleEntry({
      id: "sched-1",
      jobId: "job-1",
      jobNumber: "JOB-2026-001",
      jobTitle: "Drainage renewal",
      clientName: "Acme Groundworks",
      title: "Site work",
      startDatetime: "2026-02-01T08:00:00Z",
      endDatetime: "2026-02-01T16:00:00Z",
      crewCount: 3,
      plantAssigned: "Excavator 1",
      foreman: "Sam Foreman",
      notes: "Bring extra piping",
      type: "site_work",
    } as any);

    expect(result).toEqual({
      id: "sched-1",
      job_id: "job-1",
      job: {
        job_number: "JOB-2026-001",
        title: "Drainage renewal",
        client: { company_name: "Acme Groundworks" },
      },
      title: "Site work",
      start_datetime: "2026-02-01T08:00:00Z",
      end_datetime: "2026-02-01T16:00:00Z",
      crew_count: 3,
      plant_assigned: "Excavator 1",
      foreman: "Sam Foreman",
      notes: "Bring extra piping",
      type: "site_work",
    });
  });

  it("omits the job relation when jobNumber or jobTitle is missing", () => {
    const result = toScheduleEntry({
      id: "sched-2",
      title: "Unassigned entry",
      startDatetime: "2026-02-02T08:00:00Z",
      endDatetime: "2026-02-02T16:00:00Z",
      crewCount: 1,
      type: "other",
    } as any);

    expect(result.job).toBeNull();
    expect(result.job_id).toBeNull();
  });
});

describe("toPlant", () => {
  it("maps every camelCase field to its snake_case counterpart", () => {
    const result = toPlant({
      id: "plant-1",
      name: "Excavator 1",
      registration: "AB12 CDE",
      category: "Excavator",
      make: "JCB",
      model: "3CX",
      year: 2022,
      status: "on_site",
      currentJobId: "job-1",
      currentJobTitle: "Drainage renewal",
      serviceDue: "2026-06-01",
      motDue: "2026-07-01",
      thoroughExamDue: "2026-08-01",
      notes: "Due for service soon",
      dailyRate: 250,
      owned: true,
    } as any);

    expect(result).toEqual({
      id: "plant-1",
      name: "Excavator 1",
      registration: "AB12 CDE",
      category: "Excavator",
      make: "JCB",
      model: "3CX",
      year: 2022,
      status: "on_site",
      current_job_id: "job-1",
      current_job: { title: "Drainage renewal" },
      service_due: "2026-06-01",
      mot_due: "2026-07-01",
      thorough_exam_due: "2026-08-01",
      notes: "Due for service soon",
      daily_rate: 250,
      owned: true,
    });
  });
});

describe("toRateBookEntry", () => {
  it("maps every camelCase field to its snake_case counterpart", () => {
    const result = toRateBookEntry({
      id: "rate-1",
      category: "Groundworks",
      description: "Excavation per m3",
      unit: "m3",
      labourRate: 20,
      materialRate: 5,
      plantRate: 15,
      totalRate: 40,
      notes: "Standard rate",
    } as any);

    expect(result).toEqual({
      id: "rate-1",
      category: "Groundworks",
      description: "Excavation per m3",
      unit: "m3",
      labour_rate: 20,
      material_rate: 5,
      plant_rate: 15,
      total_rate: 40,
      notes: "Standard rate",
    });
  });
});

describe("toPurchaseOrder", () => {
  it("maps every camelCase field to its snake_case counterpart", () => {
    const result = toPurchaseOrder({
      id: "po-1",
      poNumber: "PO-2026-001",
      jobId: "job-1",
      jobNumber: "JOB-2026-001",
      jobTitle: "Drainage renewal",
      supplier: "Concrete Supplies Ltd",
      description: "20 bags of cement",
      amount: 400,
      vatAmount: 80,
      totalAmount: 480,
      status: "ordered",
      orderDate: "2026-01-01",
      expectedDelivery: "2026-01-10",
      deliveryDate: "2026-01-09",
      notes: "Deliver to site",
      createdAt: "2026-01-01T00:00:00Z",
    });

    expect(result).toEqual({
      id: "po-1",
      po_number: "PO-2026-001",
      job_id: "job-1",
      job_number: "JOB-2026-001",
      job_title: "Drainage renewal",
      supplier: "Concrete Supplies Ltd",
      description: "20 bags of cement",
      amount: 400,
      vat_amount: 80,
      total_amount: 480,
      status: "ordered",
      order_date: "2026-01-01",
      expected_delivery: "2026-01-10",
      delivery_date: "2026-01-09",
      notes: "Deliver to site",
      created_at: "2026-01-01T00:00:00Z",
    });
  });

  it("defaults nullable fields and coerces amounts when absent", () => {
    const result = toPurchaseOrder({
      id: "po-2",
      poNumber: "PO-2026-002",
      supplier: "Bare Supplier",
      description: "Bare order",
      status: "draft",
      orderDate: "2026-01-02",
      createdAt: "2026-01-02T00:00:00Z",
    });

    expect(result).toEqual({
      id: "po-2",
      po_number: "PO-2026-002",
      job_id: null,
      job_number: null,
      job_title: null,
      supplier: "Bare Supplier",
      description: "Bare order",
      amount: 0,
      vat_amount: 0,
      total_amount: 0,
      status: "draft",
      order_date: "2026-01-02",
      expected_delivery: null,
      delivery_date: null,
      notes: null,
      created_at: "2026-01-02T00:00:00Z",
    });
  });
});

describe("toTimesheet", () => {
  it("maps every camelCase field to its snake_case counterpart", () => {
    const result = toTimesheet({
      id: "ts-1",
      jobId: "job-1",
      jobNumber: "JOB-2026-001",
      jobTitle: "Drainage renewal",
      workerName: "Sam Foreman",
      workDate: "2026-02-01",
      hoursWorked: 9,
      dayRate: 200,
      cost: 200,
      description: "Groundwork",
      createdBy: "user-1",
      createdAt: "2026-02-01T18:00:00Z",
    });

    expect(result).toEqual({
      id: "ts-1",
      job_id: "job-1",
      job_number: "JOB-2026-001",
      job_title: "Drainage renewal",
      worker_name: "Sam Foreman",
      work_date: "2026-02-01",
      hours_worked: 9,
      day_rate: 200,
      cost: 200,
      description: "Groundwork",
      created_by: "user-1",
      created_at: "2026-02-01T18:00:00Z",
    });
  });

  it("defaults hours_worked to 8 and nullable fields to null when absent", () => {
    const result = toTimesheet({
      id: "ts-2",
      workerName: "Bare Worker",
      workDate: "2026-02-02",
      createdAt: "2026-02-02T18:00:00Z",
    });

    expect(result).toEqual({
      id: "ts-2",
      job_id: null,
      job_number: null,
      job_title: null,
      worker_name: "Bare Worker",
      work_date: "2026-02-02",
      hours_worked: 8,
      day_rate: null,
      cost: null,
      description: null,
      created_by: null,
      created_at: "2026-02-02T18:00:00Z",
    });
  });
});
