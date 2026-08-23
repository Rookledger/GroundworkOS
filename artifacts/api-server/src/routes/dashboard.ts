import { Router } from "express";
import {
  db,
  jobsTable,
  invoicesTable,
  documentsTable,
  subcontractorsTable,
  plantTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (req, res) => {
  const [jobStats] = await db
    .select({
      activeJobs: sql<number>`count(*) filter (where ${jobsTable.status} = 'active')::int`,
      totalJobValue: sql<number>`coalesce(sum(${jobsTable.value}) filter (where ${jobsTable.status} = 'active'), 0)`,
      pendingQuotes: sql<number>`count(*) filter (where ${jobsTable.status} = 'quoted')::int`,
    })
    .from(jobsTable);

  const [invoiceStats] = await db
    .select({
      outstandingAmount: sql<number>`coalesce(sum(${invoicesTable.totalAmount}) filter (where ${invoicesTable.status} in ('sent', 'overdue')), 0)`,
      overdueInvoices: sql<number>`count(*) filter (where ${invoicesTable.status} = 'overdue')::int`,
      revenuePaid: sql<number>`coalesce(sum(${invoicesTable.totalAmount}) filter (where ${invoicesTable.status} = 'paid'), 0)`,
    })
    .from(invoicesTable);

  const [docStats] = await db
    .select({
      docAlerts: sql<number>`count(*) filter (where ${documentsTable.status} in ('expired', 'expiring_soon'))::int`,
    })
    .from(documentsTable);

  const [subStats] = await db
    .select({
      activeSubcons: sql<number>`count(*) filter (where ${subcontractorsTable.active})::int`,
    })
    .from(subcontractorsTable);

  const [plantStats] = await db
    .select({ plantCount: sql<number>`count(*)::int` })
    .from(plantTable);

  res.json({
    activeJobs: jobStats?.activeJobs ?? 0,
    outstandingAmount: invoiceStats?.outstandingAmount ?? 0,
    pendingQuotes: jobStats?.pendingQuotes ?? 0,
    docAlerts: docStats?.docAlerts ?? 0,
    overdueInvoices: invoiceStats?.overdueInvoices ?? 0,
    totalJobValue: jobStats?.totalJobValue ?? 0,
    revenuePaid: invoiceStats?.revenuePaid ?? 0,
    activeSubcons: subStats?.activeSubcons ?? 0,
    plantCount: plantStats?.plantCount ?? 0,
  });
});

export default router;
