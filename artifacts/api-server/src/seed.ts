import {
  db,
  clientsTable,
  jobsTable,
  quotesTable,
  lineItemsTable,
  invoicesTable,
  subcontractorsTable,
  documentsTable,
  scheduleEntriesTable,
  plantTable,
  rateBookTable,
  idCountersTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Hard safeguard: this script wipes-in fixed demo data and must never touch
 * a real database. NODE_ENV=production is refused outright with no
 * override. Any other environment must point DATABASE_URL at a recognized
 * local/dev host; anything else needs the SEED_CONFIRM_NON_LOCAL_DB=yes
 * escape hatch, so seeding a non-local database (a shared staging DB
 * someone forgot to set NODE_ENV=production on, for example) takes a
 * deliberate, explicit choice instead of happening by accident.
 */
const LOCAL_DB_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
]);

function assertSafeToSeed() {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Refusing to seed: NODE_ENV is 'production'. This script inserts fixed " +
        "demo data and can never run against a production database.",
    );
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  let hostname = "";
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    // Missing/malformed URL: falls through to the allowlist check below,
    // which will reject the empty hostname.
  }

  if (
    !LOCAL_DB_HOSTS.has(hostname) &&
    process.env.SEED_CONFIRM_NON_LOCAL_DB !== "yes"
  ) {
    console.error(
      `Refusing to seed: DATABASE_URL host "${hostname || "(unparseable)"}" ` +
        "is not in the local/development allowlist " +
        `(${Array.from(LOCAL_DB_HOSTS).join(", ")}).\n` +
        "If you are certain this is not a production or shared database, " +
        "re-run with SEED_CONFIRM_NON_LOCAL_DB=yes to proceed.",
    );
    process.exit(1);
  }
}

assertSafeToSeed();

const todayDate = new Date().toISOString().split("T")[0];
function futureDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

// Matches the year derivation in lib/generateId.ts's nextSeqNumber(), so
// seeded sequence numbers always land in the same year bucket that
// newly-generated ones would.
const year = new Date().getFullYear();

async function seed() {
  console.log("Seeding database...");

  await db
    .insert(clientsTable)
    .values([
      {
        id: "c1",
        companyName: "Midlands Build Ltd",
        contactName: "Steve Hartley",
        email: "steve@midlandsbuild.co.uk",
        phone: "07712 334 556",
        address: "14 Canalside Ind. Est, Birmingham, B12 0PQ",
        vatNumber: "GB 234 5678 90",
        notes: null,
      },
      {
        id: "c2",
        companyName: "Trent Developments PLC",
        contactName: "Mark Okafor",
        email: "mark.okafor@trentdev.co.uk",
        phone: "07834 221 890",
        address: "3 Commerce Park, Nottingham, NG1 1AB",
        vatNumber: "GB 876 4321 12",
        notes: null,
      },
      {
        id: "c3",
        companyName: "Peak Civil Engineering",
        contactName: "Diane Sutcliffe",
        email: "dsutcliffe@peakcivil.co.uk",
        phone: "07590 112 344",
        address: "Holborn Rd, Sheffield, S3 8BG",
        vatNumber: "GB 543 9910 33",
        notes: "Preferred subcontractor status",
      },
      {
        id: "c4",
        companyName: "Wolverhampton Homes",
        contactName: "James Bayliss",
        email: "jbayliss@wvhomes.co.uk",
        phone: "07441 668 990",
        address: "67 Stafford St, Wolverhampton, WV1 1NB",
        vatNumber: "GB 112 3300 88",
        notes: null,
      },
      {
        id: "c5",
        companyName: "Severn Valley Groundworks",
        contactName: "Rachel Moss",
        email: "rachel@svgw.co.uk",
        phone: "07722 990 123",
        address: "Unit 7, Stourport Rd, Kidderminster, DY11 7QX",
        vatNumber: "GB 667 2219 55",
        notes: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(jobsTable)
    .values([
      {
        id: "j1",
        jobNumber: `GW-${year}-001`,
        title: "Drainage & Sewers - New Estate Phase 1",
        clientId: "c1",
        type: "drainage",
        siteAddress: "Longbridge Lane, Birmingham, B31 4SX",
        value: 85000,
        startDate: "2026-03-01",
        endDate: "2026-09-30",
        status: "active",
        progressPercent: 72,
        description:
          "Full drainage and sewer connection for 45-plot residential estate. Includes CCTV survey on completion.",
        foreman: "Dave Walters",
        crewCount: 6,
        nrswaRequired: true,
        permitNumber: "BCC-2026-0892",
      },
      {
        id: "j2",
        jobNumber: `GW-${year}-002`,
        title: "Concrete Foundations - Industrial Unit",
        clientId: "c2",
        type: "foundations",
        siteAddress: "Redfield Way, Nottingham, NG8 3FW",
        value: 47500,
        startDate: "2026-04-10",
        endDate: "2026-08-15",
        status: "active",
        progressPercent: 45,
        description:
          "Strip and trench foundations for 2400sqm industrial unit. RC pile caps and ground beams.",
        foreman: "Colin Sharp",
        crewCount: 4,
        nrswaRequired: false,
        permitNumber: null,
      },
      {
        id: "j3",
        jobNumber: `GW-${year}-003`,
        title: "Kerbing & Subbase - Car Park Extension",
        clientId: "c3",
        type: "kerbing",
        siteAddress: "Holborn Rd, Sheffield, S3 8BG",
        value: 22000,
        startDate: "2026-01-15",
        endDate: "2026-02-28",
        status: "complete",
        progressPercent: 100,
        description:
          "Precast kerbing, MOT Type 1 subbase and bitmac base course for 3200sqm car park.",
        foreman: "Dave Walters",
        crewCount: 3,
        nrswaRequired: false,
        permitNumber: null,
      },
      {
        id: "j4",
        jobNumber: `GW-${year}-004`,
        title: "Utility Ducting - High Street Scheme",
        clientId: "c4",
        type: "utilities",
        siteAddress: "High St, Wolverhampton, WV1 1TN",
        value: 38000,
        startDate: "2026-05-05",
        endDate: "2026-07-20",
        status: "active",
        progressPercent: 20,
        description:
          "Installation of MDPE gas mains, HPPE electric ducting and MDPE water mains under carriageway.",
        foreman: "Raj Patel",
        crewCount: 5,
        nrswaRequired: true,
        permitNumber: "WCC-2026-1134",
      },
      {
        id: "j5",
        jobNumber: `GW-${year}-005`,
        title: "Reinstatement Works - Gas Main Repair",
        clientId: "c5",
        type: "reinstatement",
        siteAddress: "Comberton Rd, Kidderminster, DY10 3EF",
        value: 12500,
        startDate: "2026-03-18",
        endDate: "2026-03-25",
        status: "complete",
        progressPercent: 100,
        description:
          "Full permanent reinstatement following emergency gas main repair. Category B carriageway.",
        foreman: "Raj Patel",
        crewCount: 2,
        nrswaRequired: true,
        permitNumber: "WCC-2026-1202",
      },
      {
        id: "j6",
        jobNumber: `GW-${year}-006`,
        title: "Bulk Excavation - New Housing Site",
        clientId: "c1",
        type: "excavation",
        siteAddress: "Shenley Lane, Birmingham, B29 4HG",
        value: 63000,
        startDate: "2026-10-01",
        endDate: null,
        status: "quoted",
        progressPercent: 0,
        description:
          "Mass excavation and disposal of approx 8,500m³ of made ground. Temporary works design included.",
        foreman: null,
        crewCount: null,
        nrswaRequired: false,
        permitNumber: null,
      },
      {
        id: "j7",
        jobNumber: `GW-${year}-007`,
        title: "Piling - 4-Storey Apartment Block",
        clientId: "c2",
        type: "piling",
        siteAddress: "Canal St, Nottingham, NG1 7HJ",
        value: 125000,
        startDate: "2026-11-01",
        endDate: null,
        status: "quoted",
        progressPercent: 0,
        description:
          "CFA piling 180No 450mm dia piles to depths of 12-18m. Piling mat and RC caps included.",
        foreman: null,
        crewCount: null,
        nrswaRequired: false,
        permitNumber: null,
      },
      {
        id: "j8",
        jobNumber: `GW-${year}-008`,
        title: "Sewer Inspection & Repair",
        clientId: "c3",
        type: "sewers",
        siteAddress: "Woodseats Rd, Sheffield, S8 0PD",
        value: 9500,
        startDate: "2026-10-10",
        endDate: null,
        status: "enquiry",
        progressPercent: 0,
        description:
          "CCTV survey of existing sewer network, patch lining defective sections.",
        foreman: null,
        crewCount: null,
        nrswaRequired: false,
        permitNumber: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(quotesTable)
    .values([
      {
        id: "q1",
        quoteNumber: `QT-${year}-012`,
        clientId: "c1",
        jobId: "j6",
        title: "Bulk Excavation - New Housing Site",
        status: "sent",
        subtotal: 52500,
        vatAmount: 10500,
        totalAmount: 63000,
        validUntil: "2026-07-31",
        notes:
          "Price based on site investigation report dated 12/04/26. Disposal costs subject to tip charges in force at time of works.",
        sentAt: new Date("2026-05-22T09:00:00Z"),
      },
      {
        id: "q2",
        quoteNumber: `QT-${year}-013`,
        clientId: "c2",
        jobId: "j7",
        title: "CFA Piling - Canal St Apartments",
        status: "accepted",
        subtotal: 104167,
        vatAmount: 20833,
        totalAmount: 125000,
        validUntil: "2026-08-01",
        notes:
          "Pile test to be carried out by others. Site investigation assumed adequate for design.",
        sentAt: new Date("2026-05-27T09:00:00Z"),
      },
      {
        id: "q3",
        quoteNumber: `QT-${year}-011`,
        clientId: "c4",
        jobId: null,
        title: "Subbase & Drainage - Phase 2 Housing",
        status: "draft",
        subtotal: 78400,
        vatAmount: 15680,
        totalAmount: 94080,
        validUntil: "2026-09-30",
        notes: null,
        sentAt: null,
      },
      {
        id: "q4",
        quoteNumber: `QT-${year}-009`,
        clientId: "c5",
        jobId: null,
        title: "Car Park Resurfacing Works",
        status: "declined",
        subtotal: 18500,
        vatAmount: 3700,
        totalAmount: 22200,
        validUntil: "2026-02-28",
        notes: "Client opted for alternative contractor.",
        sentAt: new Date("2026-01-22T09:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(lineItemsTable)
    .values([
      {
        id: "li1",
        quoteId: "q1",
        description: "Bulk excavation and disposal offsite",
        quantity: 8500,
        unit: "m³",
        unitPrice: 5.5,
        total: 46750,
      },
      {
        id: "li2",
        quoteId: "q1",
        description: "Temporary works design and installation",
        quantity: 1,
        unit: "Item",
        unitPrice: 4500,
        total: 4500,
      },
      {
        id: "li3",
        quoteId: "q1",
        description: "Dewatering allowance",
        quantity: 1,
        unit: "Item",
        unitPrice: 1250,
        total: 1250,
      },
      {
        id: "li4",
        quoteId: "q2",
        description: "CFA piling 450mm dia - per linear metre",
        quantity: 2700,
        unit: "lm",
        unitPrice: 32.5,
        total: 87750,
      },
      {
        id: "li5",
        quoteId: "q2",
        description: "Piling mat - hardcore and geotextile",
        quantity: 850,
        unit: "m²",
        unitPrice: 12,
        total: 10200,
      },
      {
        id: "li6",
        quoteId: "q2",
        description: "Reinforced pile caps (180 No)",
        quantity: 180,
        unit: "No",
        unitPrice: 35.65,
        total: 6417,
      },
      {
        id: "li7",
        quoteId: "q3",
        description: "Excavation to formation level",
        quantity: 5600,
        unit: "m²",
        unitPrice: 4.5,
        total: 25200,
      },
      {
        id: "li8",
        quoteId: "q3",
        description: "Supply and lay MOT Type 1 subbase 250mm",
        quantity: 5600,
        unit: "m²",
        unitPrice: 8.75,
        total: 49000,
      },
      {
        id: "li9",
        quoteId: "q3",
        description: "150mm UPVC drainage with gullies",
        quantity: 420,
        unit: "lm",
        unitPrice: 10,
        total: 4200,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(invoicesTable)
    .values([
      {
        id: "i1",
        invoiceNumber: `INV-${year}-021`,
        clientId: "c1",
        jobId: "j1",
        quoteId: null,
        subtotal: 28500,
        vatAmount: 5700,
        totalAmount: 34200,
        status: "paid",
        issuedDate: "2026-03-01",
        dueDate: "2026-03-31",
        paidAt: new Date("2026-04-10T00:00:00Z"),
        notes: "Stage 1 payment - drainage installation complete",
        cisDeduction: null,
      },
      {
        id: "i2",
        invoiceNumber: `INV-${year}-025`,
        clientId: "c1",
        jobId: "j1",
        quoteId: null,
        subtotal: 25000,
        vatAmount: 5000,
        totalAmount: 30000,
        status: "sent",
        issuedDate: "2026-06-01",
        dueDate: "2026-07-01",
        paidAt: null,
        notes: "Stage 2 payment - sewer connection and testing",
        cisDeduction: null,
      },
      {
        id: "i3",
        invoiceNumber: `INV-${year}-019`,
        clientId: "c2",
        jobId: "j2",
        quoteId: null,
        subtotal: 20000,
        vatAmount: 4000,
        totalAmount: 24000,
        status: "overdue",
        issuedDate: "2026-04-15",
        dueDate: "2026-05-15",
        paidAt: null,
        notes: "Stage 1 - excavation and blinding",
        cisDeduction: null,
      },
      {
        id: "i4",
        invoiceNumber: `INV-${year}-022`,
        clientId: "c3",
        jobId: "j3",
        quoteId: null,
        subtotal: 18333,
        vatAmount: 3667,
        totalAmount: 22000,
        status: "paid",
        issuedDate: "2026-02-01",
        dueDate: "2026-03-01",
        paidAt: new Date("2026-03-20T00:00:00Z"),
        notes: "Final account - all works complete",
        cisDeduction: null,
      },
      {
        id: "i5",
        invoiceNumber: `INV-${year}-024`,
        clientId: "c5",
        jobId: "j5",
        quoteId: null,
        subtotal: 10417,
        vatAmount: 2083,
        totalAmount: 12500,
        status: "paid",
        issuedDate: "2026-04-01",
        dueDate: "2026-04-30",
        paidAt: new Date("2026-04-28T00:00:00Z"),
        notes: null,
        cisDeduction: null,
      },
      {
        id: "i6",
        invoiceNumber: `INV-${year}-026`,
        clientId: "c4",
        jobId: "j4",
        quoteId: null,
        subtotal: 8500,
        vatAmount: 1700,
        totalAmount: 10200,
        status: "overdue",
        issuedDate: "2026-05-01",
        dueDate: "2026-05-31",
        paidAt: null,
        notes: "Initial mobilisation and excavation works",
        cisDeduction: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(subcontractorsTable)
    .values([
      {
        id: "s1",
        companyName: "BK Drainage Solutions",
        contactName: "Barry Knowles",
        email: "bk@bkdrainage.co.uk",
        phone: "07811 556 332",
        utrNumber: "1234 56789 01",
        cisStatus: "gross",
        cisDeductionRate: 0,
        trade: "Drainage",
        nrswaCardNumber: "SR12345",
        nrswaExpiry: "2027-06-30",
        publicLiabilityExpiry: "2027-03-31",
        cscsCardExpiry: "2028-01-15",
        address: "22 Pump House Lane, Birmingham, B15 3TH",
        notes: "Preferred drainage specialist",
        active: true,
      },
      {
        id: "s2",
        companyName: "J&T Plant Hire",
        contactName: "Tommy Jenkins",
        email: "tommy@jtplant.co.uk",
        phone: "07733 118 992",
        utrNumber: "9876 54321 00",
        cisStatus: "net",
        cisDeductionRate: 20,
        trade: "Plant Hire",
        nrswaCardNumber: null,
        nrswaExpiry: null,
        publicLiabilityExpiry: "2026-07-15",
        cscsCardExpiry: "2027-08-20",
        address: "Depot Rd, Walsall, WS1 4NP",
        notes: null,
        active: true,
      },
      {
        id: "s3",
        companyName: "TJ Concrete Ltd",
        contactName: "Steve Tomkins",
        email: "steve@tjconcrete.co.uk",
        phone: "07900 442 110",
        utrNumber: "5555 44444 33",
        cisStatus: "gross",
        cisDeductionRate: 0,
        trade: "Concrete Works",
        nrswaCardNumber: null,
        nrswaExpiry: null,
        publicLiabilityExpiry: "2026-07-31",
        cscsCardExpiry: "2027-04-10",
        address: "8 Quarry Bank Rd, Dudley, DY2 9EL",
        notes: "Public liability expires soon — request renewal",
        active: true,
      },
      {
        id: "s4",
        companyName: "Northern Groundworks Ltd",
        contactName: "Alan Hodgson",
        email: "ahodgson@northerngroundworks.co.uk",
        phone: "07521 334 667",
        utrNumber: "2222 11111 99",
        cisStatus: "net",
        cisDeductionRate: 20,
        trade: "Groundworks",
        nrswaCardNumber: "SR67890",
        nrswaExpiry: "2028-02-28",
        publicLiabilityExpiry: "2027-07-31",
        cscsCardExpiry: "2027-12-31",
        address: "55 Industrial Ave, Rotherham, S60 1DL",
        notes: null,
        active: true,
      },
      {
        id: "s5",
        companyName: "Quick Set Piling",
        contactName: "Gareth Williams",
        email: "g.williams@quicksetpiling.co.uk",
        phone: "07644 887 003",
        utrNumber: "7777 88888 11",
        cisStatus: "unverified",
        cisDeductionRate: 30,
        trade: "Piling",
        nrswaCardNumber: null,
        nrswaExpiry: null,
        publicLiabilityExpiry: "2027-05-31",
        cscsCardExpiry: "2027-11-30",
        address: "Piling House, Stoke-on-Trent, ST4 5JR",
        notes: "Awaiting CIS verification",
        active: true,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(documentsTable)
    .values([
      {
        id: "d1",
        name: "Public Liability Insurance 2025/26",
        type: "insurance",
        status: "valid",
        expiryDate: "2027-03-31",
        issuedDate: "2026-04-01",
        relatedTo: "company",
        relatedId: null,
        relatedName: "GroundworkOS Ltd",
        notes: "£10m cover - Aviva",
      },
      {
        id: "d2",
        name: "Employers Liability Insurance 2025/26",
        type: "insurance",
        status: "valid",
        expiryDate: "2027-03-31",
        issuedDate: "2026-04-01",
        relatedTo: "company",
        relatedId: null,
        relatedName: "GroundworkOS Ltd",
        notes: "£10m statutory cover - Aviva",
      },
      {
        id: "d3",
        name: "CHAS Accreditation",
        type: "certification",
        status: "expiring_soon",
        expiryDate: "2026-08-31",
        issuedDate: "2025-09-01",
        relatedTo: "company",
        relatedId: null,
        relatedName: "GroundworkOS Ltd",
        notes: "Renewal submitted — awaiting confirmation",
      },
      {
        id: "d4",
        name: "Constructionline Gold",
        type: "certification",
        status: "valid",
        expiryDate: "2027-08-31",
        issuedDate: "2026-09-01",
        relatedTo: "company",
        relatedId: null,
        relatedName: "GroundworkOS Ltd",
        notes: null,
      },
      {
        id: "d5",
        name: "RAMS - Drainage & Sewers Phase 1",
        type: "rams",
        status: "valid",
        expiryDate: null,
        issuedDate: "2026-02-20",
        relatedTo: "job",
        relatedId: "j1",
        relatedName: `GW-${year}-001`,
        notes: "Rev 2 - approved by client 20/02/26",
      },
      {
        id: "d6",
        name: "RAMS - Utility Ducting High Street",
        type: "rams",
        status: "valid",
        expiryDate: null,
        issuedDate: "2026-05-01",
        relatedTo: "job",
        relatedId: "j4",
        relatedName: `GW-${year}-004`,
        notes: "Includes Traffic Management Plan",
      },
      {
        id: "d7",
        name: "Street Works Permit - Utility Ducting",
        type: "permit",
        status: "valid",
        expiryDate: "2026-07-20",
        issuedDate: "2026-05-05",
        relatedTo: "job",
        relatedId: "j4",
        relatedName: `GW-${year}-004`,
        notes: "Major Works Permit WCC-2026-1134",
      },
      {
        id: "d8",
        name: "TJ Concrete - Public Liability",
        type: "insurance",
        status: "expiring_soon",
        expiryDate: "2026-07-31",
        issuedDate: "2025-08-01",
        relatedTo: "subcontractor",
        relatedId: "s3",
        relatedName: "TJ Concrete Ltd",
        notes: "Request renewal certificate urgently",
      },
      {
        id: "d9",
        name: "JCB 3CX Thorough Examination",
        type: "compliance",
        status: "valid",
        expiryDate: "2027-02-14",
        issuedDate: "2026-02-14",
        relatedTo: "plant",
        relatedId: "p1",
        relatedName: "JCB 3CX - YD21 XPR",
        notes: "LOLER Thorough Examination cert",
      },
      {
        id: "d10",
        name: "SMSTS Cert - Dave Walters",
        type: "certification",
        status: "valid",
        expiryDate: "2031-03-15",
        issuedDate: "2026-03-15",
        relatedTo: "company",
        relatedId: null,
        relatedName: "Dave Walters",
        notes: "5-year cert",
      },
      {
        id: "d11",
        name: "NRSWA Supervisor - Raj Patel",
        type: "certification",
        status: "valid",
        expiryDate: "2029-01-20",
        issuedDate: "2026-01-20",
        relatedTo: "company",
        relatedId: null,
        relatedName: "Raj Patel",
        notes: "Unit 002, 003, 010",
      },
      {
        id: "d12",
        name: "ISO 9001:2015 Certification",
        type: "certification",
        status: "expired",
        expiryDate: "2026-06-01",
        issuedDate: "2023-06-01",
        relatedTo: "company",
        relatedId: null,
        relatedName: "GroundworkOS Ltd",
        notes: "Renewal required — contact BSI",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(scheduleEntriesTable)
    .values([
      {
        id: "se1",
        jobId: "j1",
        title: "Drain run chainage 0-120m",
        startDatetime: new Date(`${todayDate}T07:30:00`),
        endDatetime: new Date(`${todayDate}T17:00:00`),
        crewCount: 5,
        plantAssigned: "JCB 3CX, Wacker Plate",
        foreman: "Dave Walters",
        notes: "Aim to complete drain run to manhole 6",
        type: "site_work",
      },
      {
        id: "se2",
        jobId: "j4",
        title: "Gas duct installation Day 3",
        startDatetime: new Date(`${todayDate}T07:00:00`),
        endDatetime: new Date(`${todayDate}T16:30:00`),
        crewCount: 4,
        plantAssigned: "Bobcat E35, Road Saw",
        foreman: "Raj Patel",
        notes: "Traffic management in place from 0630",
        type: "site_work",
      },
      {
        id: "se3",
        jobId: "j2",
        title: "Concrete pour - pile caps grid A",
        startDatetime: new Date(`${futureDate(1)}T07:00:00`),
        endDatetime: new Date(`${futureDate(1)}T16:30:00`),
        crewCount: 3,
        plantAssigned: "Concrete Pump, Poker Vibrator",
        foreman: "Colin Sharp",
        notes: "Pumping from Hanson Nottingham — call-off 0700",
        type: "site_work",
      },
      {
        id: "se4",
        jobId: "j1",
        title: "CCTV drain survey sections 1-3",
        startDatetime: new Date(`${futureDate(2)}T07:30:00`),
        endDatetime: new Date(`${futureDate(2)}T13:00:00`),
        crewCount: 2,
        plantAssigned: "CCTV Van",
        foreman: "Dave Walters",
        notes: "Survey and produce report for client",
        type: "inspection",
      },
      {
        id: "se5",
        jobId: null,
        title: "Plant Delivery - JCB 13t to Nottingham",
        startDatetime: new Date(`${futureDate(2)}T06:00:00`),
        endDatetime: new Date(`${futureDate(2)}T10:00:00`),
        crewCount: 1,
        plantAssigned: "Hiab Transport",
        foreman: null,
        notes: "Lowloader booked from depot 0600",
        type: "delivery",
      },
      {
        id: "se6",
        jobId: "j4",
        title: "Site meeting - WCC Inspector",
        startDatetime: new Date(`${futureDate(3)}T09:00:00`),
        endDatetime: new Date(`${futureDate(3)}T11:00:00`),
        crewCount: 2,
        plantAssigned: null,
        foreman: "Raj Patel",
        notes: "Compliance check and inspection",
        type: "meeting",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(plantTable)
    .values([
      {
        id: "p1",
        name: "JCB 3CX Backhoe Loader",
        registration: "YD21 XPR",
        category: "Backhoe",
        make: "JCB",
        model: "3CX Pro",
        year: 2021,
        status: "on_site",
        currentJobId: "j1",
        serviceDue: "2026-09-15",
        motDue: null,
        thoroughExamDue: "2027-02-14",
        notes: null,
        dailyRate: 280,
        owned: true,
      },
      {
        id: "p2",
        name: "Bobcat E35 Mini Excavator",
        registration: null,
        category: "Excavator",
        make: "Bobcat",
        model: "E35",
        year: 2022,
        status: "on_site",
        currentJobId: "j4",
        serviceDue: "2026-10-01",
        motDue: null,
        thoroughExamDue: "2027-03-10",
        notes: null,
        dailyRate: 195,
        owned: true,
      },
      {
        id: "p3",
        name: "Komatsu PC138 13t Excavator",
        registration: "SN68 VKB",
        category: "Excavator",
        make: "Komatsu",
        model: "PC138US-11",
        year: 2019,
        status: "available",
        currentJobId: null,
        serviceDue: "2026-08-28",
        motDue: null,
        thoroughExamDue: "2026-12-05",
        notes: "Service due August — book in",
        dailyRate: 420,
        owned: true,
      },
      {
        id: "p4",
        name: "Wacker Plate Compactor",
        registration: null,
        category: "Compaction",
        make: "Wacker Neuson",
        model: "DPU 6555",
        year: 2020,
        status: "on_site",
        currentJobId: "j1",
        serviceDue: "2026-09-01",
        motDue: null,
        thoroughExamDue: null,
        notes: null,
        dailyRate: 55,
        owned: true,
      },
      {
        id: "p5",
        name: "3t Dumper",
        registration: null,
        category: "Dumper",
        make: "Thwaites",
        model: "MACH 3",
        year: 2021,
        status: "available",
        currentJobId: null,
        serviceDue: "2026-10-01",
        motDue: null,
        thoroughExamDue: "2027-01-20",
        notes: null,
        dailyRate: 120,
        owned: true,
      },
      {
        id: "p6",
        name: "Hilta Road Saw",
        registration: null,
        category: "Saw",
        make: "Hilta",
        model: "FS500",
        year: 2022,
        status: "maintenance",
        currentJobId: null,
        serviceDue: "2026-06-30",
        motDue: null,
        thoroughExamDue: null,
        notes: "Diamond blade replacement — in workshop",
        dailyRate: 75,
        owned: true,
      },
      {
        id: "p7",
        name: "Benford PT2000 Roller",
        registration: null,
        category: "Roller",
        make: "Benford",
        model: "PT2000",
        year: 2018,
        status: "hired_in",
        currentJobId: null,
        serviceDue: null,
        motDue: null,
        thoroughExamDue: null,
        notes: "Hired from Hewden — returns Friday",
        dailyRate: 145,
        owned: false,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(rateBookTable)
    .values([
      {
        id: "rb1",
        category: "Drainage",
        description: "Excavation for drain trench 0-1.5m deep",
        unit: "m³",
        labourRate: 12.5,
        materialRate: 0,
        plantRate: 8.0,
        totalRate: 20.5,
        notes: "Includes disposal to waste",
      },
      {
        id: "rb2",
        category: "Drainage",
        description: "UPVC 110mm drainage pipe laid and haunched",
        unit: "lm",
        labourRate: 8.0,
        materialRate: 6.5,
        plantRate: 2.0,
        totalRate: 16.5,
        notes: null,
      },
      {
        id: "rb3",
        category: "Drainage",
        description: "UPVC 150mm drainage pipe laid and haunched",
        unit: "lm",
        labourRate: 9.0,
        materialRate: 9.0,
        plantRate: 2.5,
        totalRate: 20.5,
        notes: null,
      },
      {
        id: "rb4",
        category: "Drainage",
        description: "UPVC 225mm drainage pipe laid and haunched",
        unit: "lm",
        labourRate: 12.0,
        materialRate: 18.0,
        plantRate: 4.0,
        totalRate: 34.0,
        notes: null,
      },
      {
        id: "rb5",
        category: "Drainage",
        description: "Standard 450mm dia precast concrete manhole to 1.5m",
        unit: "No",
        labourRate: 180,
        materialRate: 350,
        plantRate: 60,
        totalRate: 590,
        notes: "Per No. including frame and cover",
      },
      {
        id: "rb6",
        category: "Excavation",
        description: "Bulk excavation by machine",
        unit: "m³",
        labourRate: 2.5,
        materialRate: 0,
        plantRate: 3.0,
        totalRate: 5.5,
        notes: "Excludes disposal — add tip charges",
      },
      {
        id: "rb7",
        category: "Excavation",
        description: "Disposal of excavated material offsite",
        unit: "m³",
        labourRate: 1.0,
        materialRate: 8.5,
        plantRate: 2.0,
        totalRate: 11.5,
        notes: "Material tip charge variable",
      },
      {
        id: "rb8",
        category: "Subbase",
        description: "Supply and lay MOT Type 1 subbase 150mm",
        unit: "m²",
        labourRate: 3.0,
        materialRate: 4.5,
        plantRate: 1.5,
        totalRate: 9.0,
        notes: null,
      },
      {
        id: "rb9",
        category: "Subbase",
        description: "Supply and lay MOT Type 1 subbase 250mm",
        unit: "m²",
        labourRate: 4.0,
        materialRate: 6.75,
        plantRate: 2.0,
        totalRate: 12.75,
        notes: null,
      },
      {
        id: "rb10",
        category: "Kerbing",
        description: "Precast concrete kerb type HB2 laid on C7.5 bed",
        unit: "lm",
        labourRate: 9.0,
        materialRate: 7.5,
        plantRate: 1.5,
        totalRate: 18.0,
        notes: null,
      },
      {
        id: "rb11",
        category: "Kerbing",
        description: "Precast concrete edging 50x150mm",
        unit: "lm",
        labourRate: 7.0,
        materialRate: 4.0,
        plantRate: 1.0,
        totalRate: 12.0,
        notes: null,
      },
      {
        id: "rb12",
        category: "Foundations",
        description: "Strip foundation excavation and concrete C25 250mm",
        unit: "lm",
        labourRate: 22.0,
        materialRate: 18.0,
        plantRate: 6.0,
        totalRate: 46.0,
        notes: "Width 600mm assumed",
      },
      {
        id: "rb13",
        category: "Reinstatement",
        description: "Cat B carriageway permanent reinstatement",
        unit: "m²",
        labourRate: 18.0,
        materialRate: 32.0,
        plantRate: 8.0,
        totalRate: 58.0,
        notes: "Per Highways England SHW",
      },
      {
        id: "rb14",
        category: "Reinstatement",
        description: "Cat A footway permanent reinstatement",
        unit: "m²",
        labourRate: 14.0,
        materialRate: 20.0,
        plantRate: 4.0,
        totalRate: 38.0,
        notes: "Block paving match existing",
      },
      {
        id: "rb15",
        category: "Piling",
        description: "CFA pile 450mm dia per linear metre",
        unit: "lm",
        labourRate: 15.0,
        materialRate: 12.0,
        plantRate: 5.5,
        totalRate: 32.5,
        notes: null,
      },
      {
        id: "rb16",
        category: "Piling",
        description: "Pile cap RC 600x600x300 incl rebar",
        unit: "No",
        labourRate: 18.0,
        materialRate: 12.0,
        plantRate: 5.65,
        totalRate: 35.65,
        notes: null,
      },
      {
        id: "rb17",
        category: "Concrete",
        description: "RC ground beam 300x400mm incl rebar and formwork",
        unit: "lm",
        labourRate: 35.0,
        materialRate: 42.0,
        plantRate: 8.0,
        totalRate: 85.0,
        notes: null,
      },
      {
        id: "rb18",
        category: "Concrete",
        description: "Blinding concrete C10 75mm thick",
        unit: "m²",
        labourRate: 4.0,
        materialRate: 5.5,
        plantRate: 1.5,
        totalRate: 11.0,
        notes: null,
      },
    ])
    .onConflictDoNothing();

  // The rows above are seeded with hand-picked sequence numbers (jobNumber,
  // quoteNumber, invoiceNumber) rather than through nextSeqNumber() (see
  // lib/generateId.ts). Sync id_counters to the highest number actually used
  // per year so the next real POST /jobs, /quotes or /invoices doesn't
  // generate a number that collides with one of these seeded rows (which
  // fails with a unique-constraint 500).
  async function syncSeqCounter(
    tableName: string,
    numbers: Array<string | null>,
  ) {
    const highestByYear = new Map<string, number>();
    for (const num of numbers) {
      const match = num?.match(/-(\d{4})-(\d+)$/);
      if (!match) continue;
      const [, year, seq] = match;
      const key = `${tableName}:${year}`;
      highestByYear.set(
        key,
        Math.max(highestByYear.get(key) ?? 0, Number(seq)),
      );
    }
    for (const [key, value] of highestByYear) {
      await db
        .insert(idCountersTable)
        .values({ key, value })
        .onConflictDoUpdate({
          target: idCountersTable.key,
          set: { value: sql`greatest(${idCountersTable.value}, ${value})` },
        });
    }
  }

  await syncSeqCounter("jobs", [
    `GW-${year}-001`,
    `GW-${year}-002`,
    `GW-${year}-003`,
    `GW-${year}-004`,
    `GW-${year}-005`,
    `GW-${year}-006`,
    `GW-${year}-007`,
    `GW-${year}-008`,
  ]);
  await syncSeqCounter("quotes", [
    `QT-${year}-012`,
    `QT-${year}-013`,
    `QT-${year}-011`,
    `QT-${year}-009`,
  ]);
  await syncSeqCounter("invoices", [
    `INV-${year}-021`,
    `INV-${year}-025`,
    `INV-${year}-019`,
    `INV-${year}-022`,
    `INV-${year}-024`,
    `INV-${year}-026`,
  ]);

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
