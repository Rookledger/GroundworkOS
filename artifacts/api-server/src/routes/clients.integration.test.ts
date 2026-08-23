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
const { db, clientsTable } = await import("@workspace/db");
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

describe("full write cycle for /api/clients/:id", () => {
  it("creates, reads, updates and deletes a client against the real database", async () => {
    const createRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Integration Test Ltd",
        contactName: "Ada Lovelace",
        email: "ada@example.com",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.companyName).toBe("Integration Test Ltd");
    // A brand-new client has no jobs yet, so the join-derived stats must be
    // zeroed rather than left undefined or null.
    expect(created.totalJobs).toBe(0);
    expect(created.totalValue).toBe(0);

    const getRes = await fetch(`${baseUrl}/api/clients/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.companyName).toBe("Integration Test Ltd");
    expect(fetched.contactName).toBe("Ada Lovelace");

    const patchRes = await fetch(`${baseUrl}/api/clients/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "Integration Test Holdings Ltd" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.companyName).toBe("Integration Test Holdings Ltd");

    const [persisted] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, created.id));
    expect(persisted?.companyName).toBe("Integration Test Holdings Ltd");
    // contactName was not part of the PATCH body, so it must survive untouched.
    expect(persisted?.contactName).toBe("Ada Lovelace");

    const deleteRes = await fetch(`${baseUrl}/api/clients/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/clients/${created.id}`);
    expect(getAfterDelete.status).toBe(404);

    const rowsAfterDelete = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
