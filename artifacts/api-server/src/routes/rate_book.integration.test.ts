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
const { db, rateBookTable } = await import("@workspace/db");
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

describe("full write cycle for /api/rate-book/:id", () => {
  it("creates, lists, updates and deletes a rate book entry against the real database", async () => {
    const createRes = await fetch(`${baseUrl}/api/rate-book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "Integration",
        description: "Integration test rate",
        unit: "m²",
        labourRate: 10,
        materialRate: 5,
        plantRate: 2,
        totalRate: 17,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.totalRate).toBe(17);

    // Rate book has no GET /:id route; confirm the created row via the list
    // endpoint instead.
    const listRes = await fetch(`${baseUrl}/api/rate-book`);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const fetched = list.find((e: any) => e.id === created.id);
    expect(fetched).toBeTruthy();
    expect(fetched.description).toBe("Integration test rate");

    const patchRes = await fetch(`${baseUrl}/api/rate-book/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labourRate: 20, totalRate: 27 }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.labourRate).toBe(20);
    expect(patched.totalRate).toBe(27);

    const [persisted] = await db
      .select()
      .from(rateBookTable)
      .where(eq(rateBookTable.id, created.id));
    expect(persisted?.labourRate).toBe(20);
    expect(persisted?.totalRate).toBe(27);

    const deleteRes = await fetch(`${baseUrl}/api/rate-book/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(rateBookTable)
      .where(eq(rateBookTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
