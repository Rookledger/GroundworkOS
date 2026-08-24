import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUserList, getUser, updateUserMetadata, warnMock } = vi.hoisted(
  () => ({
    getUserList: vi.fn(),
    getUser: vi.fn(),
    updateUserMetadata: vi.fn(),
    warnMock: vi.fn(),
  }),
);

vi.mock("@clerk/express", () => ({
  clerkClient: {
    users: { getUserList, getUser, updateUserMetadata },
    invitations: {},
  },
}));

// admin.ts imports the real pino logger for its boot-time warning; mock it
// out so tests just observe whether that warning would have been logged.
vi.mock("../lib/logger", () => ({
  logger: { warn: warnMock, error: vi.fn(), info: vi.fn() },
}));

const originalEnv = { ...process.env };

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

/**
 * Fakes clerkClient.users.getUserList's pagination contract: returns
 * `users` one USER_LIST_PAGE_SIZE-sized (or smaller) page at a time,
 * honoring the `offset` the caller passes, with `totalCount` reflecting the
 * full list. Lets tests exercise the real pagination loop in admin.ts
 * instead of assuming it always fetches a single page.
 */
function mockPaginatedUsers(users: any[], pageSize = 500) {
  getUserList.mockImplementation(
    async ({ offset = 0 }: { limit?: number; offset?: number } = {}) => {
      return {
        data: users.slice(offset, offset + pageSize),
        totalCount: users.length,
      };
    },
  );
}

function makeReq(overrides: Record<string, any> = {}) {
  return { ...overrides } as any;
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

async function loadAdminRoutes(
  envOverrides: Record<string, string | undefined> = {},
) {
  vi.resetModules();
  process.env = { ...originalEnv, ...envOverrides };
  getUserList.mockReset();
  getUser.mockReset();
  updateUserMetadata.mockReset();
  warnMock.mockClear();
  updateUserMetadata.mockImplementation(async () => ({}));
  const mod = await import("./admin");
  return mod;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("adminExists", () => {
  it("returns false for an admin-less workspace", async () => {
    const { adminExists } = await loadAdminRoutes();
    mockPaginatedUsers([
      makeUser({ id: "u1", publicMetadata: {} }),
      makeUser({ id: "u2", publicMetadata: { role: "manager" } }),
    ]);
    await expect(adminExists()).resolves.toBe(false);
  });

  it("returns true when an explicit admin role exists", async () => {
    const { adminExists } = await loadAdminRoutes();
    mockPaginatedUsers([
      makeUser({ id: "u1", publicMetadata: { role: "foreman" } }),
      makeUser({ id: "u2", publicMetadata: { role: "admin" } }),
    ]);
    await expect(adminExists()).resolves.toBe(true);
  });

  it("treats an unset role as non-admin, never as admin-by-default", async () => {
    const { adminExists } = await loadAdminRoutes();
    mockPaginatedUsers([makeUser({ id: "u1", publicMetadata: {} })]);
    await expect(adminExists()).resolves.toBe(false);
  });

  it("stops paginating as soon as it finds an admin (early exit)", async () => {
    const { adminExists } = await loadAdminRoutes();
    // Page 1 (500 users, none admin) then page 2 with the admin.
    const page1 = Array.from({ length: 500 }, (_, i) =>
      makeUser({ id: `u${i}`, publicMetadata: {} }),
    );
    const page2 = [
      makeUser({ id: "admin1", publicMetadata: { role: "admin" } }),
    ];
    mockPaginatedUsers([...page1, ...page2]);

    await expect(adminExists()).resolves.toBe(true);
    // Exactly 2 pages fetched: it stopped once it found the admin on page 2,
    // it didn't keep paginating past that.
    expect(getUserList).toHaveBeenCalledTimes(2);
  });

  it("paginates past a single 500-user page to find an admin beyond it (fix for silent re-open bug)", async () => {
    const { adminExists } = await loadAdminRoutes();
    // 600 total users; the one admin is on the second page (index 550),
    // which a naive single-call getUserList({ limit: 500 }) would miss.
    const users = Array.from({ length: 600 }, (_, i) =>
      makeUser({ id: `u${i}`, publicMetadata: {} }),
    );
    users[550] = makeUser({ id: "admin1", publicMetadata: { role: "admin" } });
    mockPaginatedUsers(users);

    await expect(adminExists()).resolves.toBe(true);
    expect(getUserList).toHaveBeenCalledTimes(2);
  });

  it("returns false after exhausting every page with no admin found", async () => {
    const { adminExists } = await loadAdminRoutes();
    const users = Array.from({ length: 1200 }, (_, i) =>
      makeUser({ id: `u${i}`, publicMetadata: {} }),
    );
    mockPaginatedUsers(users);

    await expect(adminExists()).resolves.toBe(false);
    expect(getUserList).toHaveBeenCalledTimes(3);
  });
});

describe("GET /admin/bootstrap-status", () => {
  it("rejects an unauthenticated caller", async () => {
    const { default: router } = await loadAdminRoutes();
    const layer = router.stack.find(
      (l: any) => l.route?.path === "/admin/bootstrap-status",
    );
    const handler = layer.route.stack[0].handle;
    const res = makeRes();
    await handler(makeReq({ userId: null }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("reports adminExists from the full paginated scan", async () => {
    const { default: router } = await loadAdminRoutes();
    mockPaginatedUsers([
      makeUser({ id: "u1", publicMetadata: { role: "admin" } }),
    ]);
    const layer = router.stack.find(
      (l: any) => l.route?.path === "/admin/bootstrap-status",
    );
    const handler = layer.route.stack[0].handle;
    const res = makeRes();
    await handler(makeReq({ userId: "user_1" }), res);
    expect(res.json).toHaveBeenCalledWith({
      adminExists: true,
      justBootstrapped: false,
    });
  });

  it("auto-bootstraps the caller on a genuinely admin-less workspace, with no separate click", async () => {
    const { default: router } = await loadAdminRoutes();
    getUser.mockResolvedValue(makeUser({ id: "user_1", publicMetadata: {} }));
    // Starts admin-less; once attemptBootstrap's write lands, subsequent
    // scans (its own TOCTOU re-check, and this route's final report) see it.
    let bootstrapped = false;
    getUserList.mockImplementation(async ({ offset = 0 } = {}) => {
      const users = bootstrapped
        ? [makeUser({ id: "user_1", publicMetadata: { role: "admin" } })]
        : [];
      return { data: users.slice(offset), totalCount: users.length };
    });
    updateUserMetadata.mockImplementation(async () => {
      bootstrapped = true;
      return {};
    });

    const layer = router.stack.find(
      (l: any) => l.route?.path === "/admin/bootstrap-status",
    );
    const handler = layer.route.stack[0].handle;
    const res = makeRes();
    await handler(makeReq({ userId: "user_1" }), res);

    expect(updateUserMetadata).toHaveBeenCalledWith("user_1", {
      publicMetadata: { role: "admin" },
    });
    expect(res.json).toHaveBeenCalledWith({
      adminExists: true,
      justBootstrapped: true,
    });
  });

  it("does not auto-bootstrap a caller who doesn't match BOOTSTRAP_ADMIN_EMAIL", async () => {
    const { default: router } = await loadAdminRoutes({
      BOOTSTRAP_ADMIN_EMAIL: "owner@example.com",
    });
    getUser.mockResolvedValue(
      makeUser({
        id: "stranger",
        publicMetadata: {},
        primaryEmailAddress: { emailAddress: "stranger@example.com" },
      }),
    );
    mockPaginatedUsers([]); // still admin-less throughout

    const layer = router.stack.find(
      (l: any) => l.route?.path === "/admin/bootstrap-status",
    );
    const handler = layer.route.stack[0].handle;
    const res = makeRes();
    await handler(makeReq({ userId: "stranger" }), res);

    expect(updateUserMetadata).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      adminExists: false,
      justBootstrapped: false,
    });
  });

  it("does not attempt bootstrap when an admin already exists (no wasted write)", async () => {
    const { default: router } = await loadAdminRoutes();
    mockPaginatedUsers([
      makeUser({ id: "existing_admin", publicMetadata: { role: "admin" } }),
    ]);
    const layer = router.stack.find(
      (l: any) => l.route?.path === "/admin/bootstrap-status",
    );
    const handler = layer.route.stack[0].handle;
    const res = makeRes();
    await handler(makeReq({ userId: "user_1" }), res);

    expect(getUser).not.toHaveBeenCalled();
    expect(updateUserMetadata).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      adminExists: true,
      justBootstrapped: false,
    });
  });
});

describe("POST /admin/bootstrap", () => {
  function getBootstrapHandler(router: any) {
    const layer = router.stack.find(
      (l: any) => l.route?.path === "/admin/bootstrap",
    );
    return layer.route.stack[0].handle;
  }

  it("rejects an unauthenticated caller", async () => {
    const { default: router } = await loadAdminRoutes();
    const handler = getBootstrapHandler(router);
    const res = makeRes();
    await handler(makeReq({ userId: null }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(updateUserMetadata).not.toHaveBeenCalled();
  });

  it("promotes the caller to admin on a genuinely admin-less workspace", async () => {
    const { default: router } = await loadAdminRoutes();
    getUser.mockResolvedValue(makeUser({ id: "user_1", publicMetadata: {} }));
    mockPaginatedUsers([]); // no admin exists yet, and none after the write
    const handler = getBootstrapHandler(router);
    const res = makeRes();
    await handler(makeReq({ userId: "user_1" }), res);

    expect(updateUserMetadata).toHaveBeenCalledWith("user_1", {
      publicMetadata: { role: "admin" },
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("refuses to bootstrap when an admin already exists (409)", async () => {
    const { default: router } = await loadAdminRoutes();
    getUser.mockResolvedValue(makeUser({ id: "user_1", publicMetadata: {} }));
    mockPaginatedUsers([
      makeUser({ id: "existing_admin", publicMetadata: { role: "admin" } }),
    ]);
    const handler = getBootstrapHandler(router);
    const res = makeRes();
    await handler(makeReq({ userId: "user_1" }), res);

    expect(updateUserMetadata).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  describe("BOOTSTRAP_ADMIN_EMAIL restriction", () => {
    it("logs a boot-time warning when BOOTSTRAP_ADMIN_EMAIL is unset", async () => {
      await loadAdminRoutes({ BOOTSTRAP_ADMIN_EMAIL: undefined });
      expect(warnMock).toHaveBeenCalledWith(
        expect.stringContaining("BOOTSTRAP_ADMIN_EMAIL is not set"),
      );
    });

    it("does not warn at boot when BOOTSTRAP_ADMIN_EMAIL is set", async () => {
      await loadAdminRoutes({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com" });
      expect(warnMock).not.toHaveBeenCalled();
    });

    it("allows bootstrap for the configured email", async () => {
      const { default: router } = await loadAdminRoutes({
        BOOTSTRAP_ADMIN_EMAIL: "owner@example.com",
      });
      getUser.mockResolvedValue(
        makeUser({
          id: "user_1",
          publicMetadata: {},
          primaryEmailAddress: { emailAddress: "owner@example.com" },
        }),
      );
      mockPaginatedUsers([]);
      const handler = getBootstrapHandler(router);
      const res = makeRes();
      await handler(makeReq({ userId: "user_1" }), res);

      expect(updateUserMetadata).toHaveBeenCalledWith("user_1", {
        publicMetadata: { role: "admin" },
      });
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it("matches the configured email case-insensitively", async () => {
      const { default: router } = await loadAdminRoutes({
        BOOTSTRAP_ADMIN_EMAIL: "Owner@Example.com",
      });
      getUser.mockResolvedValue(
        makeUser({
          id: "user_1",
          publicMetadata: {},
          primaryEmailAddress: { emailAddress: "OWNER@EXAMPLE.COM" },
        }),
      );
      mockPaginatedUsers([]);
      const handler = getBootstrapHandler(router);
      const res = makeRes();
      await handler(makeReq({ userId: "user_1" }), res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it("rejects a caller whose email doesn't match BOOTSTRAP_ADMIN_EMAIL (land-grab prevention)", async () => {
      const { default: router } = await loadAdminRoutes({
        BOOTSTRAP_ADMIN_EMAIL: "owner@example.com",
      });
      getUser.mockResolvedValue(
        makeUser({
          id: "attacker",
          publicMetadata: {},
          primaryEmailAddress: { emailAddress: "attacker@evil.com" },
        }),
      );
      mockPaginatedUsers([]);
      const handler = getBootstrapHandler(router);
      const res = makeRes();
      await handler(makeReq({ userId: "attacker" }), res);

      expect(updateUserMetadata).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("TOCTOU race handling", () => {
    it("lets the deterministic winner (earliest updatedAt) of a detected race keep admin", async () => {
      const { default: router } = await loadAdminRoutes();
      const handler = getBootstrapHandler(router);

      getUser.mockResolvedValue(
        makeUser({ id: "user_winner", publicMetadata: {} }),
      );

      let calls = 0;
      getUserList.mockImplementation(async () => {
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

      const res = makeRes();
      await handler(makeReq({ userId: "user_winner" }), res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      // Only the original grant - no restorative demotion for the winner.
      expect(updateUserMetadata).toHaveBeenCalledTimes(1);
      expect(updateUserMetadata).toHaveBeenCalledWith("user_winner", {
        publicMetadata: { role: "admin" },
      });
    });

    it("demotes the losing racer back to its prior role and reports 409", async () => {
      const { default: router } = await loadAdminRoutes();
      const handler = getBootstrapHandler(router);

      getUser.mockResolvedValue(
        makeUser({ id: "user_loser", publicMetadata: { role: "manager" } }),
      );

      let calls = 0;
      getUserList.mockImplementation(async () => {
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

      const res = makeRes();
      await handler(makeReq({ userId: "user_loser" }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(updateUserMetadata).toHaveBeenLastCalledWith("user_loser", {
        publicMetadata: { role: "manager" },
      });
    });
  });
});
