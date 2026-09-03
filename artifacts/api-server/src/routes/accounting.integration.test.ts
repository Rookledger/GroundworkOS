import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb } from "@workspace/db";
import xeroRouter from "./xero";
import quickbooksRouter from "./quickbooks";
import sageRouter from "./sage";
import freeagentRouter from "./freeagent";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real routers against a real (local, migrated)
 * D1 database - see vitest.integration.config.ts and
 * test/apply-migrations.ts. Identity/role is injected directly via
 * `c.set("userId", ...)` / `c.set("_role", ...)` in a small stand-in
 * middleware (mirroring app.ts's real session middleware) rather than
 * routes/index.ts or lib/auth.ts, so production auth code is completely
 * untouched.
 *
 * The four accounting providers (Xero, QuickBooks, Sage, FreeAgent) share
 * connect/callback/disconnect/status plumbing via accountingOAuthFactory.ts.
 * Their OAuth flows need live provider accounts and so aren't exercised
 * here; this instead pins down that each provider's status route still
 * responds on its existing path after the shared-factory refactor, since a
 * mistake there (e.g. a wrong `provider` key) would silently 404 a route
 * whose path is registered with the provider and can't move.
 */
function buildApp() {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", createDb(env.DB));
    c.set("userId", "integration-test-user");
    c.set("_role", "admin");
    c.set("logger", {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as never);
    await next();
  });
  app.route("/", xeroRouter);
  app.route("/", quickbooksRouter);
  app.route("/", sageRouter);
  app.route("/", freeagentRouter);
  return app;
}

describe.each([
  ["xero", "/xero/status"],
  ["quickbooks", "/quickbooks/status"],
  ["sage", "/sage/status"],
  ["freeagent", "/freeagent/status"],
])("GET %s status route", (_provider, path) => {
  it(`responds on ${path} with a disconnected status when no connection is stored`, async () => {
    const app = buildApp();
    const res = await app.request(path);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toEqual({ connected: false });
  });
});
