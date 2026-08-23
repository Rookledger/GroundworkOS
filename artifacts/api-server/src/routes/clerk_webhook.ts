import { Router, type RequestHandler } from "express";
import { clerkClient } from "@clerk/express";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { isRole } from "@workspace/shared-role";
import { logger } from "../lib/logger";
import { adminExists } from "./admin";
import { emailDomainAllowed, parseAllowedDomains } from "../lib/signupPolicy";

const router = Router();

/**
 * validateEnv.ts fails boot if SIGNUP_ALLOWED_EMAIL_DOMAINS is set without
 * CLERK_WEBHOOK_SIGNING_SECRET, so by the time this module runs, either the
 * allowlist is unset or the signing secret is present.
 */
const allowedDomains = parseAllowedDomains(
  process.env.SIGNUP_ALLOWED_EMAIL_DOMAINS,
);

/** Rebuilds the Fetch API Request verifyWebhook expects from an Express
 * request whose body was captured raw (see app.ts, which routes this path
 * through express.raw() instead of the global JSON body parser - svix
 * signature verification needs the exact original bytes). */
function toFetchRequest(req: Parameters<RequestHandler>[0]): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return new Request(`${req.protocol}://${req.get("host")}${req.originalUrl}`, {
    method: "POST",
    headers,
    body: req.body,
  });
}

/**
 * Defense-in-depth for sign-up restriction. The primary control is Clerk
 * Dashboard -> Restrictions (sign-up mode = Restricted, optionally with its
 * own allowlist) - that's what actually stops an unauthorized account from
 * being created in the first place. This webhook is a server-side backstop:
 * if SIGNUP_ALLOWED_EMAIL_DOMAINS is configured and an account somehow gets
 * created anyway for a disallowed email (Restrictions left open, or
 * misconfigured), and it wasn't provisioned through our own admin-invite
 * flow (which stamps a role into publicMetadata at invite time - see
 * routes/admin.ts), it's deleted immediately.
 *
 * Skipped while the workspace has no admin yet, so it can never interfere
 * with the one-time bootstrap flow in routes/admin.ts.
 */
const handleClerkWebhook: RequestHandler = async (req, res) => {
  let event;
  try {
    event = await verifyWebhook(toFetchRequest(req));
  } catch (err) {
    logger.warn({ err }, "Clerk webhook signature verification failed");
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  if (event.type === "user.created" && allowedDomains.length > 0) {
    const user = event.data;
    const email =
      user.email_addresses.find((e) => e.id === user.primary_email_address_id)
        ?.email_address ?? user.email_addresses[0]?.email_address;
    const invitedWithRole = isRole(
      (user.public_metadata as Record<string, unknown> | null)?.role,
    );

    if (
      email &&
      !invitedWithRole &&
      !emailDomainAllowed(email, allowedDomains) &&
      (await adminExists())
    ) {
      logger.warn(
        { userId: user.id, email },
        "Deleting unauthorized sign-up: email domain not on SIGNUP_ALLOWED_EMAIL_DOMAINS",
      );
      await clerkClient.users.deleteUser(user.id);
    }
  }

  res.status(200).json({ received: true });
};

router.post("/webhooks/clerk", handleClerkWebhook);

export default router;
