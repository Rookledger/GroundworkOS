import { Hono } from "hono";
import { subcontractorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserRole, requireRole } from "../lib/auth.js";
import {
  CreateSubcontractorInput,
  UpdateSubcontractorInput,
} from "@workspace/api-zod";
import { logAudit } from "./audit.js";
import { generateId } from "../lib/generateId.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

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
const ADMIN_ONLY_FIELDS = ["cisStatus", "cisDeductionRate", "utrNumber"] as const;

router.get("/subcontractors", requireRole("manager"), async (c) => {
  const subs = await c
    .get("db")
    .select()
    .from(subcontractorsTable)
    .orderBy(subcontractorsTable.companyName);
  return c.json(subs);
});

router.post("/subcontractors", requireRole("manager"), async (c) => {
  const parsed = CreateSubcontractorInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const data = parsed.data;
  const id = generateId();
  const [sub] = await db
    .insert(subcontractorsTable)
    .values({ id, ...data })
    .returning();
  await logAudit(c, "subcontractor", id, "create", {
    companyName: data.companyName,
  });
  return c.json(sub, 201);
});

router.get("/subcontractors/:id", requireRole("manager"), async (c) => {
  const id = c.req.param("id");
  const [sub] = await c
    .get("db")
    .select()
    .from(subcontractorsTable)
    .where(eq(subcontractorsTable.id, id));
  if (!sub) return c.json({ error: "Not found" }, 404);
  return c.json(sub);
});

router.patch("/subcontractors/:id", requireRole("manager"), async (c) => {
  const parsed = UpdateSubcontractorInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      400,
    );
  }
  const db = c.get("db");
  const id = c.req.param("id");
  const body = parsed.data;
  const role = await getUserRole(c);
  const requestedFields = Object.keys(body);
  const touchesAdminOnly = requestedFields.some((f) =>
    (ADMIN_ONLY_FIELDS as readonly string[]).includes(f),
  );
  if (touchesAdminOnly && role !== "admin") {
    return c.json(
      {
        error:
          "Forbidden: admin role required to change CIS status, deduction rate, or UTR",
      },
      403,
    );
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
    .where(eq(subcontractorsTable.id, id))
    .returning();
  if (!sub) return c.json({ error: "Not found" }, 404);
  await logAudit(c, "subcontractor", id, "update", data);
  return c.json(sub);
});

router.delete("/subcontractors/:id", requireRole("manager"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await logAudit(c, "subcontractor", id, "delete", null);
  await db.delete(subcontractorsTable).where(eq(subcontractorsTable.id, id));
  return c.body(null, 204);
});

export default router;
