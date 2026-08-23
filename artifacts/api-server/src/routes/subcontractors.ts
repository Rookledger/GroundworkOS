import { Router } from "express";
import { db, subcontractorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserRole, requireRole } from "../lib/auth.js";
import {
  CreateSubcontractorInput,
  UpdateSubcontractorInput,
} from "@workspace/api-zod";
import { logAudit } from "./audit.js";

const router = Router();

// Fields any user may edit about a subcontractor's own record.
const SELF_SERVICE_FIELDS = [
  "companyName",
  "contactName",
  "email",
  "phone",
  "trade",
  "nrswaCardNumber",
  "nrswaExpiry",
  "publicLiabilityExpiry",
  "cscsCardExpiry",
  "address",
  "notes",
  "active",
] as const;

// Compliance-sensitive fields that control CIS verification/deduction —
// only an admin should be able to change these.
const ADMIN_ONLY_FIELDS = [
  "cisStatus",
  "cisDeductionRate",
  "utrNumber",
] as const;

router.get("/subcontractors", requireRole("manager"), async (req, res) => {
  const subs = await db
    .select()
    .from(subcontractorsTable)
    .orderBy(subcontractorsTable.companyName);
  res.json(subs);
});

router.post("/subcontractors", requireRole("manager"), async (req, res) => {
  const parsed = CreateSubcontractorInput.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const { generateId } = await import("../lib/generateId.js");
  const id = generateId();
  const [sub] = await db
    .insert(subcontractorsTable)
    .values({ id, ...data })
    .returning();
  await logAudit(
    "subcontractor",
    id,
    "create",
    { companyName: data.companyName },
    req,
  );
  return res.status(201).json(sub);
});

router.get("/subcontractors/:id", requireRole("manager"), async (req, res) => {
  const [sub] = await db
    .select()
    .from(subcontractorsTable)
    .where(eq(subcontractorsTable.id, req.params.id));
  if (!sub) return res.status(404).json({ error: "Not found" });
  return res.json(sub);
});

router.patch(
  "/subcontractors/:id",
  requireRole("manager"),
  async (req, res) => {
    const parsed = UpdateSubcontractorInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;
    const role = await getUserRole(req);
    const requestedFields = Object.keys(body);
    const touchesAdminOnly = requestedFields.some((f) =>
      (ADMIN_ONLY_FIELDS as readonly string[]).includes(f),
    );
    if (touchesAdminOnly && role !== "admin") {
      return res.status(403).json({
        error:
          "Forbidden: admin role required to change CIS status, deduction rate, or UTR",
      });
    }

    const allowed =
      role === "admin"
        ? [...SELF_SERVICE_FIELDS, ...ADMIN_ONLY_FIELDS]
        : SELF_SERVICE_FIELDS;
    const data: Record<string, unknown> = {};
    for (const field of requestedFields) {
      if ((allowed as readonly string[]).includes(field))
        data[field] = (body as Record<string, unknown>)[field];
    }

    const [sub] = await db
      .update(subcontractorsTable)
      .set(data)
      .where(eq(subcontractorsTable.id, req.params.id))
      .returning();
    if (!sub) return res.status(404).json({ error: "Not found" });
    await logAudit("subcontractor", req.params.id, "update", data, req);
    return res.json(sub);
  },
);

router.delete(
  "/subcontractors/:id",
  requireRole("manager"),
  async (req, res) => {
    await logAudit("subcontractor", req.params.id, "delete", null, req);
    await db
      .delete(subcontractorsTable)
      .where(eq(subcontractorsTable.id, req.params.id));
    res.status(204).send();
  },
);

export default router;
