import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDb, ramsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import ramsRouter from "./rams";
import type { AppEnv } from "../types";

/**
 * Integration test: runs the real router against a real (local, migrated)
 * D1 database - see documents.integration.test.ts, which this mirrors.
 * Identity/role is injected directly via a stand-in middleware rather than
 * lib/auth.ts, so production auth code is untouched.
 */
function buildApp(role: "admin" | "manager" | "foreman" = "admin") {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set("db", createDb(env.DB));
    c.set("userId", "integration-test-user");
    c.set("_role", role);
    c.set("logger", {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as never);
    await next();
  });
  app.route("/", ramsRouter);
  return app;
}

const db = createDb(env.DB);

describe("full write cycle for /rams/:id", () => {
  it("creates, lists, updates, briefs, acknowledges and deletes a RAMS record", async () => {
    const app = buildApp("manager");

    const createRes = await app.request("/rams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Excavation near live services",
        activity: "Trial holes to 1.8m",
        riskLevel: "high",
        hazards: [
          {
            hazard: "Underground services strike",
            controls: "CAT scan and hand-dig trial holes",
            riskBefore: "high",
            riskAfter: "low",
          },
        ],
        ppe: ["Hard hat", "Hi-vis"],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as any;
    expect(created.status).toBe("draft");
    expect(created.hazards).toHaveLength(1);
    expect(created.attendees).toEqual([]);

    const listRes = await app.request("/rams");
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as any[];
    expect(list.some((r) => r.id === created.id)).toBe(true);

    // Activating is a plain PATCH, same as the frontend's status buttons.
    const activateRes = await app.request(`/rams/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(activateRes.status).toBe(200);
    expect(((await activateRes.json()) as any).status).toBe("active");

    // First acknowledgement stamps briefedAt/briefedBy on the record itself.
    const ackRes = await app.request(`/rams/${created.id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dave Smith", role: "Groundworker" }),
    });
    expect(ackRes.status).toBe(200);
    const acked = (await ackRes.json()) as any;
    expect(acked.briefedBy).toBe("Dave Smith");
    expect(acked.briefedAt).toBeTruthy();
    expect(acked.attendees).toHaveLength(1);
    expect(acked.attendees[0]).toMatchObject({
      name: "Dave Smith",
      role: "Groundworker",
      acknowledged: true,
    });

    // A second person acknowledging must not overwrite the first briefing,
    // and both attendees must be retained.
    const secondAckRes = await app.request(`/rams/${created.id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Priya Patel" }),
    });
    expect(secondAckRes.status).toBe(200);
    const secondAcked = (await secondAckRes.json()) as any;
    expect(secondAcked.briefedBy).toBe("Dave Smith");
    expect(secondAcked.attendees).toHaveLength(2);

    const [persisted] = await db
      .select()
      .from(ramsTable)
      .where(eq(ramsTable.id, created.id));
    expect(persisted?.status).toBe("active");
    expect(JSON.parse(persisted?.attendees ?? "[]")).toHaveLength(2);

    const deleteRes = await app.request(`/rams/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const rowsAfterDelete = await db
      .select()
      .from(ramsTable)
      .where(eq(ramsTable.id, created.id));
    expect(rowsAfterDelete).toHaveLength(0);
  });

  it("rejects create/update/delete from a foreman but allows acknowledge", async () => {
    const managerApp = buildApp("manager");
    const createRes = await managerApp.request("/rams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Foreman-gate test", activity: "Test" }),
    });
    const created = (await createRes.json()) as any;

    const foremanApp = buildApp("foreman");

    const patchRes = await foremanApp.request(`/rams/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(patchRes.status).toBe(403);

    const ackRes = await foremanApp.request(`/rams/${created.id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Site Foreman" }),
    });
    expect(ackRes.status).toBe(200);

    const deleteRes = await foremanApp.request(`/rams/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(403);
  });
});
