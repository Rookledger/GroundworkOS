import { Hono } from "hono";
import { HealthCheckResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

/**
 * Liveness probe: the process is up and able to respond. Deliberately does
 * not touch the database, so it stays cheap and can't be dragged down (or
 * made to falsely fail) by a slow or unreachable D1.
 */
router.get("/healthz", (c) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  return c.json(data);
});

/**
 * Readiness probe: only reports "ok" once the app can actually reach D1.
 * Wire this up as a deploy-gate/synthetic check so a rollout against an
 * unmigrated or unreachable database is caught instead of passing on a
 * static "ok".
 */
router.get("/readyz", async (c) => {
  try {
    await c.get("db").run(sql`SELECT 1`);
    const data = HealthCheckResponse.parse({ status: "ok" });
    return c.json(data);
  } catch (err) {
    logger.error({ err }, "Readiness check failed: database unreachable");
    const data = HealthCheckResponse.parse({ status: "error" });
    return c.json(data, 503);
  }
});

export default router;
