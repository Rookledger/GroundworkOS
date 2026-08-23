import type { Server } from "http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("@workspace/db", () => ({ db: { execute } }));

const { default: healthRouter } = await import("./health");
const {
  HEALTH_CHECK_PATHS,
  createApiAnonLimiter,
  createApiUserLimiter,
  createHealthCheckLimiter,
} = await import("../lib/rateLimits");

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  execute.mockReset();
  const app = express();
  app.use(healthRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("GET /healthz", () => {
  it("returns ok without touching the database", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("GET /readyz", () => {
  it("returns 200 ok when the database is reachable", async () => {
    execute.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    const res = await fetch(`${baseUrl}/readyz`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns 503 when the database is unreachable", async () => {
    execute.mockRejectedValue(new Error("connection refused"));

    const res = await fetch(`${baseUrl}/readyz`);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: "error" });
  });
});

/**
 * Regression test for a self-inflicted outage: the health routes used to sit
 * behind the 30-requests-per-15-minutes public-route limiter, so Railway's
 * deploy healthcheck (railway.json -> healthcheckPath "/api/readyz",
 * healthcheckTimeout 300) could exhaust the budget while a cold database
 * warmed up and then get a hard 429 on every subsequent probe - failing a
 * deploy that was actually recovering. Any uptime monitor polling every 30s
 * tripped it permanently too.
 *
 * This mirrors app.ts's real limiter wiring rather than mounting the router
 * bare, so the assertion covers the limiters a request actually passes
 * through in production.
 */
describe("rate limiting on the health routes", () => {
  let limitedServer: Server;
  let limitedBaseUrl: string;

  beforeEach(async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use([...HEALTH_CHECK_PATHS], createHealthCheckLimiter());
    app.use(
      "/api",
      createApiUserLimiter(),
      createApiAnonLimiter(),
      healthRouter,
    );

    await new Promise<void>((resolve) => {
      limitedServer = app.listen(0, () => {
        const address = limitedServer.address();
        const port = typeof address === "object" && address ? address.port : 0;
        limitedBaseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => limitedServer.close(() => resolve()));
  });

  it("never returns 429 for 60 consecutive /api/readyz probes", async () => {
    execute.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    const statuses: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const res = await fetch(`${limitedBaseUrl}/api/readyz`);
      statuses.push(res.status);
      await res.arrayBuffer();
    }

    expect(statuses.filter((status) => status === 429)).toEqual([]);
    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it("never returns 429 for 60 consecutive /api/healthz probes", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const res = await fetch(`${limitedBaseUrl}/api/healthz`);
      statuses.push(res.status);
      await res.arrayBuffer();
    }

    expect(statuses.filter((status) => status === 429)).toEqual([]);
  });

  it("still fails readiness with 503 (not 429) when the database is down", async () => {
    execute.mockRejectedValue(new Error("connection refused"));

    const res = await fetch(`${limitedBaseUrl}/api/readyz`);

    expect(res.status).toBe(503);
  });
});
