import { Hono } from "hono";
import healthRouter from "./health";
import storageRouter from "./storage";
import clientsRouter from "./clients";
import jobsRouter from "./jobs";
import quotesRouter from "./quotes";
import invoicesRouter from "./invoices";
import subcontractorsRouter from "./subcontractors";
import documentsRouter from "./documents";
import scheduleRouter from "./schedule";
import plantRouter from "./plant";
import rateBookRouter from "./rate_book";
import dashboardRouter from "./dashboard";
import xeroRouter from "./xero";
import quickbooksRouter from "./quickbooks";
import sageRouter from "./sage";
import freeagentRouter from "./freeagent";
import settingsRouter from "./settings";
import cisRouter from "./cis";
import portalRouter from "./portal";
import adminRouter from "./admin";
import timesheetsRouter from "./timesheets";
import purchaseOrdersRouter from "./purchase_orders";
import emailRouter from "./email";
import auditRouter from "./audit";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

const PUBLIC_PATHS = [
  "/healthz",
  "/readyz",
  "/xero/callback",
  "/quickbooks/callback",
  "/sage/callback",
  "/freeagent/callback",
  "/portal",
  // The person accepting an invitation doesn't have a session yet - see
  // routes/admin.ts's POST /invitations/accept.
  "/invitations/accept",
  // Public sign-up, open only while the workspace has zero users - see
  // routes/admin.ts's GET /setup/status and POST /setup/first-admin. Neither
  // caller has a session yet, by definition.
  "/setup",
];

/**
 * `router` is mounted at "/api" in app.ts (`app.route("/api", router)`), so
 * `c.req.path` here still includes that prefix - strip it before comparing
 * against PUBLIC_PATHS, which are written relative to "/api". Better Auth's
 * own endpoints ("/api/auth/*") are mounted directly on `app` in app.ts,
 * before this router, so they never reach this guard at all.
 *
 * `userId`/`_role` are already set by app.ts's session middleware whenever
 * a valid Better Auth session exists - this just rejects the request when
 * neither is set, rather than doing its own lookup.
 */
router.use(async (c, next) => {
  const path = c.req.path.replace(/^\/api/, "") || "/";
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    return next();
  }
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

router.route("/", storageRouter);
router.route("/", healthRouter);
router.route("/", clientsRouter);
router.route("/", jobsRouter);
router.route("/", quotesRouter);
router.route("/", invoicesRouter);
router.route("/", subcontractorsRouter);
router.route("/", documentsRouter);
router.route("/", scheduleRouter);
router.route("/", plantRouter);
router.route("/", rateBookRouter);
router.route("/", dashboardRouter);
router.route("/", xeroRouter);
router.route("/", quickbooksRouter);
router.route("/", sageRouter);
router.route("/", freeagentRouter);
router.route("/", settingsRouter);
router.route("/", cisRouter);
router.route("/", portalRouter);
router.route("/", adminRouter);
router.route("/", timesheetsRouter);
router.route("/", purchaseOrdersRouter);
router.route("/", emailRouter);
router.route("/", auditRouter);

export default router;
