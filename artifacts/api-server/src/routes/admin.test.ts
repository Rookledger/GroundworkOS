import { Hono } from "hono";
import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";
import adminRouter, { adminExists } from "./admin";
import type { AppEnv, Bindings } from "../types";

vi.mock("@hono/clerk-auth", () => ({ getAuth: () => undefined }));

/** Builds a fake Clerk User with just the fields admin.ts reads. */
function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: "user_default",
    publicMetadata: {},
    updatedAt: 0,
    primaryEmailAddress: null,
    ...overrides,
  };
}

function makeFakeClerk() {
  return {
    users: {
      getUserList: vi.fn(),
      getUser: vi.fn(),
      updateUserMetadata: vi.fn(async () => ({})),
    },
    invitations: {
      getInvitationList: vi.fn(),
      createInvitation: vi.fn(),
      revokeInvitation: vi.fn(),
    },
  };
}
type FakeClerk = ReturnType<typeof makeFakeClerk>;

/**
 * Fakes clerkClient.users.getUserList's pagination contract: returns
 * `users` one USER_LIST_PAGE_SIZE-sized (or smaller) page at a time,
 * honoring the `offset` the caller passes, with `totalCount` reflecting the
 * full list. Lets tests exercise the real pagination loop in admin.ts
 * instead of assuming it always fetches a single page.
 */
function mockPaginatedUsers(
  clerk: FakeClerk,
  users: any[],
  pageSize = 500,
) {
  clerk.users.getUserList.mockImplementation(
    async ({ offset = 0 }: { limit?: number; offset?: number } = {}) => {
      return {
        data: users.slice(offset, offset + pageSize),
        totalCount: users.length,
      };
    },
  );
}

function makeLogger() {
  return { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
}

/** Fake Context carrying just what adminExists/forEachUser read off it -
 * enough to unit-test the pagination helpers without a real Hono request. */
function makeFakeContext(clerk: FakeClerk): Context<AppEnv> {
  return {
    get: (key: string) => (key === "clerk" ? clerk : undefined),
  } as unknown as Context<AppEnv>;
}

/** Mounts adminRouter with a fake Clerk client and caller identity injected
 * via middleware - mirrors how it's actually wired (app.ts sets `db`/
 * `logger`, routes/index.ts's auth guard sets `userId`), without needing a
 * real Clerk client or D1 binding. */
function buildApp(opts: { userId?: string | null; clerk: FakeClerk; logger: ReturnType<typeof makeLogger> }) {
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    if (opts.userId) c.set("userId", opts.userId);
    c.set("clerk", opts.clerk as never);
    c.set("logger", opts.logger as never);
    await next();
  });
  app.route("/", adminRouter);
  return app;
}

function makeEnv(overrides: Partial<Bindings> = {}): Partial<Bindings> {
  return { BOOTSTRAP_ADMIN_EMAIL: undefined, ...overrides };
}

describe("adminExists", () => {
  it("returns false for an admin-less workspace", async () => {
    const clerk = makeFakeClerk();
    mockPaginatedUsers(clerk, [
      makeUser({ id: "u1", publicMetadata: {} }),
      makeUser({ id: "u2", publicMetadata: { role: "manager" } }),
    ]);
    await expect(adminExists(makeFakeContext(clerk))).resolves.toBe(false);
  });

  it("returns true when an explicit admin role exists", async () => {
    const clerk = makeFakeClerk();
    mockPaginatedUsers(clerk, [
      makeUser({ id: "u1", publicMetadata: { role: "foreman" } }),
      makeUser({ id: "u2", publicMetadata: { role: "admin" } }),
    ]);
    await expect(adminExists(makeFakeContext(clerk))).resolves.toBe(true);
  });

  it("treats an unset role as non-admin, never as admin-by-default", async () => {
    const clerk = makeFakeClerk();
    mockPaginatedUsers(clerk, [makeUser({ id: "u1", publicMetadata: {} })]);
    await expect(adminExists(makeFakeContext(clerk))).resolves.toBe(false);
  });

  it("stops paginating as soon as it finds an admin (early exit)", async () => {
    const clerk = makeFakeClerk();
    // Page 1 (500 users, none admin) then page 2 with the admin.
    const page1 = Array.from({ length: 500 }, (_, i) =>
      makeUser({ id: `u${i}`, publicMetadata: {} }),
    );
    const page2 = [
      makeUser({ id: "admin1", publicMetadata: { role: "admin" } }),
    ];
    mockPaginatedUsers(clerk, [...page1, ...page2]);

    await expect(adminExists(makeFakeContext(clerk))).resolves.toBe(true);
    // Exactly 2 pages fetched: it stopped once it found the admin on page 2,
    // it didn't keep paginating past that.
    expect(clerk.users.getUserList).toHaveBeenCalledTimes(2);
  });

  it("paginates past a single 500-user page to find an admin beyond it (fix for silent re-open bug)", async () => {
    const clerk = makeFakeClerk();
    // 600 total users; the one admin is on the second page (index 550),
    // which a naive single-call getUserList({ limit: 500 }) would miss.
    const users = Array.from({ length: 600 }, (_, i) =>
      makeUser({ id: `u${i}`, publicMetadata: {} }),
    );
    users[550] = makeUser({ id: "admin1", publicMetadata: { role: "admin" } });
    mockPaginatedUsers(clerk, users);

    await expect(adminExists(makeFakeContext(clerk))).resolves.toBe(true);
    expect(clerk.users.getUserList).toHaveBeenCalledTimes(2);
  });

  it("returns false after exhausting every page with no admin found", async () => {
    const clerk = makeFakeClerk();
    const users = Array.from({ length: 1200 }, (_, i) =>
      makeUser({ id: `u${i}`, publicMetadata: {} }),
    );
    mockPaginatedUsers(clerk, users);

    await expect(adminExists(makeFakeContext(clerk))).resolves.toBe(false);
    expect(clerk.users.getUserList).toHaveBeenCalledTimes(3);
  });
});

describe("GET /admin/bootstrap-status", () => {
  it("rejects an unauthenticated caller", async () => {
    const clerk = makeFakeClerk();
    const app = buildApp({ userId: null, clerk, logger: makeLogger() });

    const res = await app.request("/admin/bootstrap-status");

    expect(res.status).toBe(401);
  });

  it("reports adminExists from the full paginated scan", async () => {
    const clerk = makeFakeClerk();
    mockPaginatedUsers(clerk, [
      makeUser({ id: "u1", publicMetadata: { role: "admin" } }),
    ]);
    const app = buildApp({ userId: "user_1", clerk, logger: makeLogger() });

    const res = await app.request(
      "/admin/bootstrap-status",
      {},
      makeEnv(),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      adminExists: true,
      justBootstrapped: false,
    });
  });

  it("auto-bootstraps the caller on a genuinely admin-less workspace, with no separate click", async () => {
    const clerk = makeFakeClerk();
    clerk.users.getUser.mockResolvedValue(
      makeUser({ id: "user_1", publicMetadata: {} }),
    );
    // Starts admin-less; once attemptBootstrap's write lands, subsequent
    // scans (its own TOCTOU re-check, and this route's final report) see it.
    let bootstrapped = false;
    clerk.users.getUserList.mockImplementation(async ({ offset = 0 } = {}) => {
      const users = bootstrapped
        ? [makeUser({ id: "user_1", publicMetadata: { role: "admin" } })]
        : [];
      return { data: users.slice(offset), totalCount: users.length };
    });
    clerk.users.updateUserMetadata.mockImplementation(async () => {
      bootstrapped = true;
      return {};
    });
    const app = buildApp({ userId: "user_1", clerk, logger: makeLogger() });

    const res = await app.request(
      "/admin/bootstrap-status",
      {},
      makeEnv(),
    );

    expect(clerk.users.updateUserMetadata).toHaveBeenCalledWith("user_1", {
      publicMetadata: { role: "admin" },
    });
    await expect(res.json()).resolves.toEqual({
      adminExists: true,
      justBootstrapped: true,
    });
  });

  it("does not auto-bootstrap a caller who doesn't match BOOTSTRAP_ADMIN_EMAIL", async () => {
    const clerk = makeFakeClerk();
    clerk.users.getUser.mockResolvedValue(
      makeUser({
        id: "stranger",
        publicMetadata: {},
        primaryEmailAddress: { emailAddress: "stranger@example.com" },
      }),
    );
    mockPaginatedUsers(clerk, []); // still admin-less throughout
    const app = buildApp({ userId: "stranger", clerk, logger: makeLogger() });

    const res = await app.request(
      "/admin/bootstrap-status",
      {},
      makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com" }),
    );

    expect(clerk.users.updateUserMetadata).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({
      adminExists: false,
      justBootstrapped: false,
    });
  });

  it("does not attempt bootstrap when an admin already exists (no wasted write)", async () => {
    const clerk = makeFakeClerk();
    mockPaginatedUsers(clerk, [
      makeUser({ id: "existing_admin", publicMetadata: { role: "admin" } }),
    ]);
    const app = buildApp({ userId: "user_1", clerk, logger: makeLogger() });

    const res = await app.request(
      "/admin/bootstrap-status",
      {},
      makeEnv(),
    );

    expect(clerk.users.getUser).not.toHaveBeenCalled();
    expect(clerk.users.updateUserMetadata).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({
      adminExists: true,
      justBootstrapped: false,
    });
  });
});

describe("POST /admin/bootstrap", () => {
  it("rejects an unauthenticated caller", async () => {
    const clerk = makeFakeClerk();
    const app = buildApp({ userId: null, clerk, logger: makeLogger() });

    const res = await app.request("/admin/bootstrap", { method: "POST" });

    expect(res.status).toBe(401);
    expect(clerk.users.updateUserMetadata).not.toHaveBeenCalled();
  });

  it("promotes the caller to admin on a genuinely admin-less workspace", async () => {
    const clerk = makeFakeClerk();
    clerk.users.getUser.mockResolvedValue(
      makeUser({ id: "user_1", publicMetadata: {} }),
    );
    mockPaginatedUsers(clerk, []); // no admin exists yet, and none after the write
    const app = buildApp({ userId: "user_1", clerk, logger: makeLogger() });

    const res = await app.request(
      "/admin/bootstrap",
      { method: "POST" },
      makeEnv(),
    );

    expect(clerk.users.updateUserMetadata).toHaveBeenCalledWith("user_1", {
      publicMetadata: { role: "admin" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("refuses to bootstrap when an admin already exists (409)", async () => {
    const clerk = makeFakeClerk();
    clerk.users.getUser.mockResolvedValue(
      makeUser({ id: "user_1", publicMetadata: {} }),
    );
    mockPaginatedUsers(clerk, [
      makeUser({ id: "existing_admin", publicMetadata: { role: "admin" } }),
    ]);
    const app = buildApp({ userId: "user_1", clerk, logger: makeLogger() });

    const res = await app.request(
      "/admin/bootstrap",
      { method: "POST" },
      makeEnv(),
    );

    expect(clerk.users.updateUserMetadata).not.toHaveBeenCalled();
    expect(res.status).toBe(409);
  });

  describe("BOOTSTRAP_ADMIN_EMAIL restriction", () => {
    it("warns when a bootstrap is attempted with BOOTSTRAP_ADMIN_EMAIL unset", async () => {
      const clerk = makeFakeClerk();
      const logger = makeLogger();
      clerk.users.getUser.mockResolvedValue(
        makeUser({ id: "user_1", publicMetadata: {} }),
      );
      mockPaginatedUsers(clerk, []);
      const app = buildApp({ userId: "user_1", clerk, logger });

      await app.request("/admin/bootstrap", { method: "POST" }, makeEnv());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("BOOTSTRAP_ADMIN_EMAIL is not set"),
      );
    });

    it("does not warn when BOOTSTRAP_ADMIN_EMAIL is set", async () => {
      const clerk = makeFakeClerk();
      const logger = makeLogger();
      clerk.users.getUser.mockResolvedValue(
        makeUser({
          id: "user_1",
          publicMetadata: {},
          primaryEmailAddress: { emailAddress: "owner@example.com" },
        }),
      );
      mockPaginatedUsers(clerk, []);
      const app = buildApp({ userId: "user_1", clerk, logger });

      await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com" }),
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("allows bootstrap for the configured email", async () => {
      const clerk = makeFakeClerk();
      clerk.users.getUser.mockResolvedValue(
        makeUser({
          id: "user_1",
          publicMetadata: {},
          primaryEmailAddress: { emailAddress: "owner@example.com" },
        }),
      );
      mockPaginatedUsers(clerk, []);
      const app = buildApp({ userId: "user_1", clerk, logger: makeLogger() });

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com" }),
      );

      expect(clerk.users.updateUserMetadata).toHaveBeenCalledWith("user_1", {
        publicMetadata: { role: "admin" },
      });
      await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("matches the configured email case-insensitively", async () => {
      const clerk = makeFakeClerk();
      clerk.users.getUser.mockResolvedValue(
        makeUser({
          id: "user_1",
          publicMetadata: {},
          primaryEmailAddress: { emailAddress: "OWNER@EXAMPLE.COM" },
        }),
      );
      mockPaginatedUsers(clerk, []);
      const app = buildApp({ userId: "user_1", clerk, logger: makeLogger() });

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "Owner@Example.com" }),
      );

      await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("rejects a caller whose email doesn't match BOOTSTRAP_ADMIN_EMAIL (land-grab prevention)", async () => {
      const clerk = makeFakeClerk();
      clerk.users.getUser.mockResolvedValue(
        makeUser({
          id: "attacker",
          publicMetadata: {},
          primaryEmailAddress: { emailAddress: "attacker@evil.com" },
        }),
      );
      mockPaginatedUsers(clerk, []);
      const app = buildApp({ userId: "attacker", clerk, logger: makeLogger() });

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com" }),
      );

      expect(clerk.users.updateUserMetadata).not.toHaveBeenCalled();
      expect(res.status).toBe(403);
    });
  });

  describe("TOCTOU race handling", () => {
    it("lets the deterministic winner (earliest updatedAt) of a detected race keep admin", async () => {
      const clerk = makeFakeClerk();
      clerk.users.getUser.mockResolvedValue(
        makeUser({ id: "user_winner", publicMetadata: {} }),
      );

      let calls = 0;
      clerk.users.getUserList.mockImplementation(async () => {
        calls += 1;
        if (calls === 1) {
          // adminExists() pre-check: nobody is admin yet.
          return { data: [], totalCount: 0 };
        }
        // Post-write re-check: another concurrent caller also wrote
        // "admin" before this write became visible to their own
        // pre-check, but this caller's write happened first.
        return {
          data: [
            makeUser({
              id: "user_winner",
              publicMetadata: { role: "admin" },
              updatedAt: 100,
            }),
            makeUser({
              id: "user_racer",
              publicMetadata: { role: "admin" },
              updatedAt: 200,
            }),
          ],
          totalCount: 2,
        };
      });
      const app = buildApp({ userId: "user_winner", clerk, logger: makeLogger() });

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv(),
      );

      await expect(res.json()).resolves.toEqual({ ok: true });
      // Only the original grant - no restorative demotion for the winner.
      expect(clerk.users.updateUserMetadata).toHaveBeenCalledTimes(1);
      expect(clerk.users.updateUserMetadata).toHaveBeenCalledWith(
        "user_winner",
        { publicMetadata: { role: "admin" } },
      );
    });

    it("demotes the losing racer back to its prior role and reports 409", async () => {
      const clerk = makeFakeClerk();
      clerk.users.getUser.mockResolvedValue(
        makeUser({ id: "user_loser", publicMetadata: { role: "manager" } }),
      );

      let calls = 0;
      clerk.users.getUserList.mockImplementation(async () => {
        calls += 1;
        if (calls === 1) {
          // adminExists() pre-check: nobody is admin yet.
          return { data: [], totalCount: 0 };
        }
        // Post-write re-check: someone else already beat this caller to it.
        return {
          data: [
            makeUser({
              id: "user_loser",
              publicMetadata: { role: "admin" },
              updatedAt: 500,
            }),
            makeUser({
              id: "user_winner",
              publicMetadata: { role: "admin" },
              updatedAt: 100,
            }),
          ],
          totalCount: 2,
        };
      });
      const app = buildApp({ userId: "user_loser", clerk, logger: makeLogger() });

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv(),
      );

      expect(res.status).toBe(409);
      expect(clerk.users.updateUserMetadata).toHaveBeenLastCalledWith(
        "user_loser",
        { publicMetadata: { role: "manager" } },
      );
    });
  });
});
