import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Liveness probe: the process is up and able to respond. Deliberately does
 * not touch the database, so it stays cheap and can't be dragged down (or
 * made to falsely fail) by a slow or unreachable database.
 */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * Readiness probe: only reports "ok" once the app can actually reach the
 * database. Used as Railway's healthcheckPath so a deploy against an
 * unmigrated or unreachable database is caught instead of passing on a
 * static "ok".
 */
router.get("/readyz", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Readiness check failed: database unreachable");
    const data = HealthCheckResponse.parse({ status: "error" });
    res.status(503).json(data);
  }
});

export default router;
