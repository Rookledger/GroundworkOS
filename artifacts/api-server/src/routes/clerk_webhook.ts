import { Hono } from "hono";

import { verifyWebhook } from "@clerk/backend/webhooks";
import { isRole } from "@workspace/shared-role";
import { adminExists } from "./admin.js";
import { emailDomainAllowed, parseAllowedDomains } from "../lib/signupPolicy.js";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

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
 *
 * Unlike the Express version, no toFetchRequest() reconstruction is needed
 * here - c.req.raw is already a native Fetch API Request, and svix
 * signature verification needs the exact original bytes, which Hono never
 * consumes unless a handler calls c.req.json()/text()/etc, so the raw body
 * verifyWebhook reads is untouched.
 */
router.post("/webhooks/clerk", async (c) => {
  let event;
  try {
    event = await verifyWebhook(c.req.raw, {
      signingSecret: c.env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch (err) {
    c.get("logger").warn({ err }, "Clerk webhook signature verification failed");
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  // validateEnv.ts fails boot if SIGNUP_ALLOWED_EMAIL_DOMAINS is set without
  // CLERK_WEBHOOK_SIGNING_SECRET, so by the time this handler runs, either
  // the allowlist is unset or the signing secret is present.
  const allowedDomains = parseAllowedDomains(c.env.SIGNUP_ALLOWED_EMAIL_DOMAINS);

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
      (await adminExists(c))
    ) {
      c.get("logger").warn(
        { userId: user.id, email },
        "Deleting unauthorized sign-up: email domain not on SIGNUP_ALLOWED_EMAIL_DOMAINS",
      );
      await c.get("clerk").users.deleteUser(user.id);
    }
  }

  return c.json({ received: true }, 200);
});

export default router;
