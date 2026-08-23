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
 * Unlike the other integration tests, this file also mocks
 * clerkClient.users.getUserList: PUT /api/settings/company's bootstrap
 * gating (routes/settings.ts) calls adminExists() (routes/admin.ts), which
 * calls getUserList, so exercising that gating logic — not just a default
 * admin role — is the whole point of this file. Defaults to "an admin
 * exists", matching a normal, already-onboarded deployment.
 */
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: () => ({ userId: "integration-test-user" }),
  clerkClient: {
    users: {
      getUser: vi.fn().mockResolvedValue({ publicMetadata: { role: "admin" } }),
      getUserList: vi
        .fn()
        .mockResolvedValue({ data: [{ publicMetadata: { role: "admin" } }] }),
    },
  },
}));

// The object storage route constructs an S3 client at import time; it's
// never exercised by this test, but the module graph still needs these set.
process.env.S3_BUCKET ??= "test-bucket";
process.env.S3_ACCESS_KEY_ID ??= "test-access-key";
process.env.S3_SECRET_ACCESS_KEY ??= "test-secret-key";

const { default: app } = await import("../app");
const { db, companySettingsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { clerkClient } = await import("@clerk/express");

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

describe("PUT /api/settings/company bootstrap gating", () => {
  it("rejects a foreman once an admin already exists", async () => {
    vi.mocked(clerkClient.users.getUserList).mockResolvedValueOnce({
      data: [{ publicMetadata: { role: "admin" } }],
    } as any);
    vi.mocked(clerkClient.users.getUser).mockResolvedValueOnce({
      publicMetadata: { role: "foreman" },
    } as any);

    const res = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Should Not Save Ltd" }),
    });
    expect(res.status).toBe(403);
  });

  it("allows a foreman through while no admin exists yet, mirroring the admin bootstrap flow", async () => {
    // adminExists() === false makes the route call next() and skip
    // requireRole entirely, so no getUser override is queued here — one
    // would sit unconsumed and leak into a later test's request.
    vi.mocked(clerkClient.users.getUserList).mockResolvedValueOnce({
      data: [],
    } as any);

    const res = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Bootstrap Onboarding Ltd" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const [persisted] = await db
      .select()
      .from(companySettingsTable)
      .where(eq(companySettingsTable.id, 1));
    expect((persisted?.data as any)?.companyName).toBe(
      "Bootstrap Onboarding Ltd",
    );
  });
});

describe("full write cycle for PUT /api/settings/company", () => {
  it("persists company settings and reflects them on GET, replacing rather than merging on a second PUT", async () => {
    const firstPut = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "GroundworkOS Ltd",
        vatNumber: "GB 123 4567 89",
      }),
    });
    expect(firstPut.status).toBe(200);

    const getAfterFirst = await fetch(`${baseUrl}/api/settings/company`);
    expect(getAfterFirst.status).toBe(200);
    const afterFirst = await getAfterFirst.json();
    expect(afterFirst.companyName).toBe("GroundworkOS Ltd");
    expect(afterFirst.vatNumber).toBe("GB 123 4567 89");

    // The route stores the parsed body verbatim as the new `data` value
    // (INSERT ... ON CONFLICT DO UPDATE SET data = <new body>) — it does not
    // merge with the previous value. A second PUT that omits vatNumber must
    // therefore drop it, not silently preserve the old value.
    const secondPut = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "GroundworkOS Holdings Ltd" }),
    });
    expect(secondPut.status).toBe(200);

    const getAfterSecond = await fetch(`${baseUrl}/api/settings/company`);
    const afterSecond = await getAfterSecond.json();
    expect(afterSecond.companyName).toBe("GroundworkOS Holdings Ltd");
    expect(afterSecond.vatNumber).toBeUndefined();

    const [persisted] = await db
      .select()
      .from(companySettingsTable)
      .where(eq(companySettingsTable.id, 1));
    expect((persisted?.data as any)?.companyName).toBe(
      "GroundworkOS Holdings Ltd",
    );
    expect((persisted?.data as any)?.vatNumber).toBeUndefined();
  });
});
