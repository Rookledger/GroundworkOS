import { Hono } from "hono";
import { getAuth } from "@hono/clerk-auth";
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
import clerkWebhookRouter from "./clerk_webhook";
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
  // Rendered by the sign-in/sign-up screens before any session exists - see
  // the handler in routes/settings.ts for what it does (and doesn't) expose.
  "/settings/branding",
  // Server-to-server from Clerk, not a signed-in user - authenticated by
  // svix signature verification inside the handler instead of a session.
  "/webhooks/clerk",
];

/**
 * `router` is mounted at "/api" in app.ts (`app.route("/api", router)`), so
 * `c.req.path` here still includes that prefix - strip it before comparing
 * against PUBLIC_PATHS, which (like the old Express version's `req.path`,
 * already relative to where the router was mounted) are written relative to
 * "/api".
 */
router.use(async (c, next) => {
  const path = c.req.path.replace(/^\/api/, "") || "/";
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    return next();
  }
  const auth = getAuth(c);
  const userId = auth?.sessionClaims?.userId ?? auth?.userId;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId", userId as string);
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
router.route("/", clerkWebhookRouter);

export default router;
