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
const { db, documentsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

let server: Server;
let baseUrl: string;

function daysFromNow(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

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

describe("POST /api/documents status derivation", () => {
  it("marks a document with no expiry as valid", async () => {
    const res = await fetch(`${baseUrl}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No-expiry cert", type: "certification" }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.status).toBe("valid");
  });

  it("marks a document with an expiry in the past as expired", async () => {
    const res = await fetch(`${baseUrl}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Lapsed insurance",
        type: "insurance",
        expiryDate: "2020-01-01",
      }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.status).toBe("expired");
  });

  it("marks a document expiring within 30 days as expiring_soon", async () => {
    const res = await fetch(`${baseUrl}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Soon-to-lapse permit",
        type: "permit",
        expiryDate: daysFromNow(10),
      }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.status).toBe("expiring_soon");
  });

  it("marks a document expiring more than 30 days out as valid", async () => {
    const res = await fetch(`${baseUrl}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Far-future permit",
        type: "permit",
        expiryDate: daysFromNow(60),
      }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.status).toBe("valid");
  });
});

describe("full write cycle for /api/documents/:id", () => {
  it("creates, lists, updates (recomputing status from expiryDate) and deletes a document", async () => {
    const createRes = await fetch(`${baseUrl}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cycle document",
        type: "certification",
        expiryDate: daysFromNow(60),
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.status).toBe("valid");

    // Documents has no GET /:id route; confirm the created row is visible
    // through the list endpoint instead.
    const listRes = await fetch(`${baseUrl}/api/documents`);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.some((d: any) => d.id === created.id)).toBe(true);

    // Moving expiryDate into the past must flip status to expired, proving
    // computeDocStatus() re-runs on update rather than only on create.
    const patchRes = await fetch(`${baseUrl}/api/documents/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiryDate: "2020-01-01" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.status).toBe("expired");

    const [persisted] = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, created.id));
    expect(persisted?.status).toBe("expired");
    expect(persisted?.expiryDate).toBe("2020-01-01");

    const deleteRes = await fetch(`${baseUrl}/api/documents/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
