import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration test: boots the real Express app against a real Postgres
 * database (DATABASE_URL must already point at a migrated + seeded
 * database — see .github/workflows/ci.yml). Clerk is stubbed out here
 * rather than in routes/index.ts or lib/auth.ts, so production auth code
 * is completely untouched; only this test's view of "@clerk/express"
 * differs.
 *
 * The four accounting providers (Xero, QuickBooks, Sage, FreeAgent) share
 * connect/callback/disconnect/status plumbing via accountingOAuthFactory.ts.
 * Their OAuth flows need live provider accounts and so aren't exercised
 * here; this instead pins down that each provider's status route still
 * responds on its existing path after the shared-factory refactor, since a
 * mistake there (e.g. a wrong `provider` key) would silently 404 a route
 * whose path is registered with the provider and can't move.
 */
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: () => ({ userId: "integration-test-user" }),
  clerkClient: {
    users: {
      getUser: vi.fn().mockResolvedValue({ publicMetadata: { role: "admin" } }),
    },
  },
}));

// The object storage route constructs an S3 client at import time; it's
// never exercised by this test, but the module graph still needs these set.
process.env.S3_BUCKET ??= "test-bucket";
process.env.S3_ACCESS_KEY_ID ??= "test-access-key";
process.env.S3_SECRET_ACCESS_KEY ??= "test-secret-key";

const { default: app } = await import("../app");

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe.each([
  ["xero", "/api/xero/status"],
  ["quickbooks", "/api/quickbooks/status"],
  ["sage", "/api/sage/status"],
  ["freeagent", "/api/freeagent/status"],
])("GET %s status route", (_provider, path) => {
  it(`responds on ${path} with a disconnected status when no connection is stored`, async () => {
    const res = await fetch(`${baseUrl}${path}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ connected: false });
  });
});
