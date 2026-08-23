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
const { db, subcontractorsTable } = await import("@workspace/db");
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

describe("full write cycle for /api/subcontractors/:id", () => {
  it("creates, reads, updates and deletes a subcontractor against the real database", async () => {
    const createRes = await fetch(`${baseUrl}/api/subcontractors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Integration Groundworks Ltd",
        trade: "Groundworks",
        cisStatus: "unverified",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.companyName).toBe("Integration Groundworks Ltd");

    const getRes = await fetch(`${baseUrl}/api/subcontractors/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.trade).toBe("Groundworks");

    const patchRes = await fetch(
      `${baseUrl}/api/subcontractors/${created.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "07000 000000" }),
      },
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.phone).toBe("07000 000000");

    const [persisted] = await db
      .select()
      .from(subcontractorsTable)
      .where(eq(subcontractorsTable.id, created.id));
    expect(persisted?.phone).toBe("07000 000000");

    const deleteRes = await fetch(
      `${baseUrl}/api/subcontractors/${created.id}`,
      { method: "DELETE" },
    );
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(
      `${baseUrl}/api/subcontractors/${created.id}`,
    );
    expect(getAfterDelete.status).toBe(404);

    const rowsAfterDelete = await db
      .select()
      .from(subcontractorsTable)
      .where(eq(subcontractorsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});

describe("PATCH /api/subcontractors/:id admin-only field gating", () => {
  it("rejects a manager attempting to change CIS-sensitive fields, but allows self-service fields", async () => {
    const [existing] = await db.select().from(subcontractorsTable).limit(1);
    expect(existing).toBeTruthy();

    vi.mocked(clerkClient.users.getUser).mockResolvedValueOnce({
      publicMetadata: { role: "manager" },
    } as any);
    const forbiddenRes = await fetch(
      `${baseUrl}/api/subcontractors/${existing!.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cisDeductionRate: 0 }),
      },
    );
    expect(forbiddenRes.status).toBe(403);

    const [unchanged] = await db
      .select()
      .from(subcontractorsTable)
      .where(eq(subcontractorsTable.id, existing!.id));
    expect(unchanged?.cisDeductionRate).toBe(existing!.cisDeductionRate);

    vi.mocked(clerkClient.users.getUser).mockResolvedValueOnce({
      publicMetadata: { role: "manager" },
    } as any);
    const allowedRes = await fetch(
      `${baseUrl}/api/subcontractors/${existing!.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Manager-editable note" }),
      },
    );
    expect(allowedRes.status).toBe(200);
    const allowed = await allowedRes.json();
    expect(allowed.notes).toBe("Manager-editable note");
  });

  it("allows an admin to change CIS-sensitive fields", async () => {
    const createRes = await fetch(`${baseUrl}/api/subcontractors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Admin CIS Test Ltd" }),
    });
    const created = await createRes.json();

    const patchRes = await fetch(
      `${baseUrl}/api/subcontractors/${created.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cisStatus: "gross",
          cisDeductionRate: 0,
          utrNumber: "1111 22222 33",
        }),
      },
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.cisStatus).toBe("gross");
    expect(patched.cisDeductionRate).toBe(0);
    expect(patched.utrNumber).toBe("1111 22222 33");

    await fetch(`${baseUrl}/api/subcontractors/${created.id}`, {
      method: "DELETE",
    });
  });
});
