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
const { db, scheduleEntriesTable, jobsTable } = await import("@workspace/db");
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

describe("full write cycle for /api/schedule/:id", () => {
  it("creates, lists (enriched with job/client), updates and deletes a schedule entry", async () => {
    const [job] = await db.select().from(jobsTable).limit(1);
    expect(job).toBeTruthy();

    const createRes = await fetch(`${baseUrl}/api/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job!.id,
        title: "Integration cycle entry",
        startDatetime: "2026-06-01T07:00:00.000Z",
        endDatetime: "2026-06-01T15:00:00.000Z",
        crewCount: 3,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.jobNumber).toBe(job!.jobNumber);
    expect(created.jobTitle).toBe(job!.title);
    expect(created.startDatetime).toBe("2026-06-01T07:00:00.000Z");
    expect(created.endDatetime).toBe("2026-06-01T15:00:00.000Z");

    // Schedule has no GET /:id route; confirm the created row via the list
    // endpoint instead.
    const listRes = await fetch(`${baseUrl}/api/schedule`);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const fetched = list.find((e: any) => e.id === created.id);
    expect(fetched).toBeTruthy();
    expect(fetched.title).toBe("Integration cycle entry");

    const patchRes = await fetch(`${baseUrl}/api/schedule/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDatetime: "2026-06-02T08:00:00.000Z",
        crewCount: 5,
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.startDatetime).toBe("2026-06-02T08:00:00.000Z");
    expect(patched.crewCount).toBe(5);
    // endDatetime was not part of the PATCH body, so it must survive untouched.
    expect(patched.endDatetime).toBe("2026-06-01T15:00:00.000Z");

    const [persisted] = await db
      .select()
      .from(scheduleEntriesTable)
      .where(eq(scheduleEntriesTable.id, created.id));
    expect(persisted?.crewCount).toBe(5);
    expect(persisted?.startDatetime.toISOString()).toBe(
      "2026-06-02T08:00:00.000Z",
    );

    const deleteRes = await fetch(`${baseUrl}/api/schedule/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(scheduleEntriesTable)
      .where(eq(scheduleEntriesTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });
});
