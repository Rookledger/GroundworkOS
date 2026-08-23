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
const { db, jobsTable } = await import("@workspace/db");
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

describe("POST /api/jobs", () => {
  it("generates a job number that does not collide with any seeded job number", async () => {
    // Same year derivation as lib/generateId.ts's nextSeqNumber() and
    // seed.ts, so this assertion holds regardless of which calendar year
    // the suite happens to run in.
    const year = new Date().getFullYear();

    const seededJobs = await db
      .select({ jobNumber: jobsTable.jobNumber })
      .from(jobsTable);
    // Sanity check: this test is only meaningful against a seeded database.
    expect(seededJobs.length).toBeGreaterThan(0);
    // Sanity check: the seeded rows must actually land in the current
    // year's bucket, otherwise the collision this test guards against
    // can't happen and the assertions below would pass vacuously.
    expect(seededJobs.some((j) => j.jobNumber.startsWith(`GW-${year}-`))).toBe(
      true,
    );
    const seededNumbers = new Set(seededJobs.map((j) => j.jobNumber));

    const res = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Integration test job" }),
    });

    expect(res.status).toBe(201);
    const job = await res.json();

    expect(job.jobNumber).toMatch(new RegExp(`^GW-${year}-\\d+$`));
    expect(seededNumbers.has(job.jobNumber)).toBe(false);

    const rows = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.jobNumber, job.jobNumber));
    expect(rows).toHaveLength(1);
  });
});

describe("full write cycle for /api/jobs/:id", () => {
  it("creates, reads, updates and deletes a job against the real database", async () => {
    const createRes = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Integration cycle job",
        status: "enquiry",
        value: 1000,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.title).toBe("Integration cycle job");
    expect(created.status).toBe("enquiry");

    const getRes = await fetch(`${baseUrl}/api/jobs/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.id).toBe(created.id);
    expect(fetched.title).toBe("Integration cycle job");

    const patchRes = await fetch(`${baseUrl}/api/jobs/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active", progressPercent: 40 }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.status).toBe("active");
    expect(patched.progressPercent).toBe(40);

    const [persisted] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, created.id));
    expect(persisted?.status).toBe("active");
    expect(persisted?.progressPercent).toBe(40);

    const deleteRes = await fetch(`${baseUrl}/api/jobs/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/jobs/${created.id}`);
    expect(getAfterDelete.status).toBe(404);

    const rowsAfterDelete = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
