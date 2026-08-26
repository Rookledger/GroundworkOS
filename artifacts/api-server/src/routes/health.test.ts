import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import healthRouter from "./health";
import {
  HEALTH_CHECK_PATHS,
  createApiAnonLimiter,
  createApiUserLimiter,
  createHealthCheckLimiter,
} from "../lib/rateLimits";
import type { AppEnv, Bindings } from "../types";

vi.mock("../lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

// The rate limiters (lib/rateLimits.ts) call getAuth(c) to key authenticated
// traffic by Clerk user id. These tests never run the real clerkMiddleware,
// so stub getAuth to report "signed out" instead of throwing.
vi.mock("@hono/clerk-auth", () => ({ getAuth: () => undefined }));

/** Minimal fake standing in for `c.get("db")` - just enough for readyz's
 * single `db.run(sql\`SELECT 1\`)` probe. */
function makeDb(run: (...args: unknown[]) => unknown) {
  return { run: vi.fn(run) };
}

/** In-memory stand-in for the KV namespace the rate limiters read/write. */
function makeKv(): Pick<KVNamespace, "get" | "put"> {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  } as unknown as Pick<KVNamespace, "get" | "put">;
}

/** Mounts healthRouter bare, with a fake `db` injected via middleware -
 * mirrors how health.ts is actually mounted (routes/index.ts -> app.ts),
 * without needing a real D1 binding. */
function buildApp(db: ReturnType<typeof makeDb>) {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", db as never);
    await next();
  });
  app.route("/", healthRouter);
  return app;
}

describe("GET /healthz", () => {
  it("returns ok without touching the database", async () => {
    const db = makeDb(() => {
      throw new Error("should not be called");
    });
    const app = buildApp(db);

    const res = await app.request("/healthz");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
    expect(db.run).not.toHaveBeenCalled();
  });
});

describe("GET /readyz", () => {
  it("returns 200 ok when the database is reachable", async () => {
    const db = makeDb(() => ({ rows: [{ "1": 1 }] }));
    const app = buildApp(db);

    const res = await app.request("/readyz");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns 503 when the database is unreachable", async () => {
    const db = makeDb(() => {
      throw new Error("connection refused");
    });
    const app = buildApp(db);

    const res = await app.request("/readyz");

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: "error" });
  });
});

/**
 * Regression test for a self-inflicted outage: the health routes used to sit
 * behind the general-purpose per-IP/per-user limiters, so an uptime monitor
 * polling frequently (or a deploy healthcheck hammering readyz while a cold
 * dependency warmed up) could exhaust that shared budget and get a hard 429
 * on every subsequent probe - failing a rollout that was actually
 * recovering. See lib/rateLimits.ts's createHealthCheckLimiter, which gives
 * the health paths their own much higher budget instead.
 *
 * This wires up the same limiter stack app.ts applies in production (health
 * limiter on HEALTH_CHECK_PATHS, then the general user/anon limiters on the
 * rest of /api), against a fake KV, so the assertion covers the limiters a
 * request actually passes through.
 */
describe("rate limiting on the health routes", () => {
  function buildLimitedApp(db: ReturnType<typeof makeDb>) {
    const inner = new Hono<AppEnv>();
    inner.use(async (c, next) => {
      c.set("db", db as never);
      await next();
    });
    inner.route("/", healthRouter);

    const app = new Hono<AppEnv>();
    for (const path of HEALTH_CHECK_PATHS.map((p) => p.replace(/^\/api/, "")))
      app.use(path, createHealthCheckLimiter());
    app.use("/api/*", createApiUserLimiter());
    app.use("/api/*", createApiAnonLimiter());
    app.route("/api", inner);
    return app;
  }

  let kv: ReturnType<typeof makeKv>;
  let env: Partial<Bindings>;
  // The KV limiter's best-effort increment goes through
  // c.executionCtx.waitUntil, which only exists on a real Workers request -
  // app.request()'s optional 4th arg supplies a stand-in.
  const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {} };

  beforeEach(() => {
    kv = makeKv();
    env = { KV: kv as unknown as KVNamespace };
  });

  it("never returns 429 for 60 consecutive /api/readyz probes", async () => {
    const db = makeDb(() => ({ rows: [{ "1": 1 }] }));
    const app = buildLimitedApp(db);

    const statuses: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const res = await app.request("/api/readyz", {}, env, executionCtx as never);
      statuses.push(res.status);
    }

    expect(statuses.filter((status) => status === 429)).toEqual([]);
    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it("never returns 429 for 60 consecutive /api/healthz probes", async () => {
    const db = makeDb(() => ({ rows: [{ "1": 1 }] }));
    const app = buildLimitedApp(db);

    const statuses: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const res = await app.request("/api/healthz", {}, env, executionCtx as never);
      statuses.push(res.status);
    }

    expect(statuses.filter((status) => status === 429)).toEqual([]);
  });

  it("still fails readiness with 503 (not 429) when the database is down", async () => {
    const db = makeDb(() => {
      throw new Error("connection refused");
    });
    const app = buildLimitedApp(db);

    const res = await app.request("/api/readyz", {}, env, executionCtx as never);

    expect(res.status).toBe(503);
  });
});
