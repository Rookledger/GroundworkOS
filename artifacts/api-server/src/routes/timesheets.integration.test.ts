import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration test: boots the real Express app against a real Postgres
 * database (DATABASE_URL must already point at a migrated + seeded
 * database — see .github/workflows/ci.yml). Clerk is stubbed out here
 * rather than in routes/index.ts or lib/auth.ts, so production auth code
 * is completely untouched; only this test's view of "@clerk/express"
 * differs.
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
const { db, timesheetsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

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

describe("POST /api/timesheets cost derivation", () => {
  it("derives cost from hoursWorked/8 * dayRate", async () => {
    const res = await fetch(`${baseUrl}/api/timesheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerName: "Dave Walters",
        workDate: "2026-06-01",
        hoursWorked: 4,
        dayRate: 200,
      }),
    });
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.cost).toBe(100);
  });

  it("leaves cost null when no dayRate is supplied", async () => {
    const res = await fetch(`${baseUrl}/api/timesheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerName: "Dave Walters",
        workDate: "2026-06-01",
        hoursWorked: 8,
      }),
    });
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.cost).toBeNull();
  });
});

describe("full write cycle for /api/timesheets/:id", () => {
  it("creates, lists, updates (recomputing cost from the existing dayRate) and deletes a timesheet", async () => {
    const createRes = await fetch(`${baseUrl}/api/timesheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerName: "Colin Sharp",
        workDate: "2026-06-02",
        hoursWorked: 8,
        dayRate: 160,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.cost).toBe(160);

    // Timesheets has no GET /:id route; confirm the created row via the list
    // endpoint instead.
    const listRes = await fetch(`${baseUrl}/api/timesheets`);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.some((t: any) => t.id === created.id)).toBe(true);

    // Updating hoursWorked alone (no dayRate in the body) must re-derive cost
    // from the timesheet's existing dayRate, not null it out or leave it stale.
    const patchRes = await fetch(`${baseUrl}/api/timesheets/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hoursWorked: 4 }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.hoursWorked).toBe(4);
    expect(patched.cost).toBe(80);

    const [persisted] = await db
      .select()
      .from(timesheetsTable)
      .where(eq(timesheetsTable.id, created.id));
    expect(persisted?.cost).toBe(80);
    expect(persisted?.dayRate).toBe(160);

    const deleteRes = await fetch(`${baseUrl}/api/timesheets/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(timesheetsTable)
      .where(eq(timesheetsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
