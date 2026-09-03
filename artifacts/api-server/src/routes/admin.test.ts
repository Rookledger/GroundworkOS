import { Hono } from "hono";
import type { Context } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import adminRouter, { adminExists } from "./admin";
import type { AppEnv, Bindings } from "../types";

/**
 * Fake `db` standing in for `c.get("db")`, backed by an in-memory array of
 * user rows and just enough Drizzle-shaped chaining (select/where/limit,
 * update/set/where) to exercise admin.ts's real queries without a real D1
 * binding. Deliberately minimal - it only supports the exact query shapes
 * admin.ts actually issues against the `user` table.
 */
type FakeUser = { id: string; role: string; email: string; updatedAt: Date };

/**
 * `staleFirstRoleScan`: simulates a concurrent racer whose write has
 * already landed in `users` but hasn't become visible to *this* caller's
 * first admin-role scan yet - the TOCTOU window attemptBootstrap() is
 * built to detect. The very first role-filtered `where` sees an empty
 * result regardless of `users`' actual contents; every scan after that
 * (in particular the post-write re-check) sees the real, current rows.
 */
function makeFakeDb(
  users: FakeUser[],
  opts: { staleFirstRoleScan?: boolean } = {},
) {
  let roleScanCount = 0;
  const db = {
    _users: users,
    select() {
      return {
        from() {
          return {
            where(cond: { kind: "role" | "id"; value: string }) {
              let rows: FakeUser[];
              if (cond.kind === "role") {
                roleScanCount += 1;
                rows =
                  opts.staleFirstRoleScan && roleScanCount === 1
                    ? []
                    : users.filter((u) => u.role === cond.value);
              } else {
                rows = users.filter((u) => u.id === cond.value);
              }
              return {
                limit: (_n: number) => Promise.resolve(rows.slice(0, _n)),
                then: (resolve: (v: FakeUser[]) => unknown) =>
                  Promise.resolve(rows).then(resolve),
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(patch: Partial<FakeUser>) {
          return {
            where(cond: { kind: "id"; value: string }) {
              const user = users.find((u) => u.id === cond.value);
              if (user) Object.assign(user, patch);
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
  return db as unknown as ReturnType<typeof import("@workspace/db").createDb>;
}

// admin.ts uses drizzle-orm's `eq(userTable.role, "admin")` /
// `eq(userTable.id, id)` builders as the `where` argument. Stub `eq` so our
// fake db above can pattern-match on which column it targets without
// needing a real Drizzle table/column object.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (column: { name?: string }, value: string) => ({
      kind: column?.name === "role" ? "role" : "id",
      value,
    }),
  };
});

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: "user_default",
    role: "foreman",
    email: "",
    updatedAt: new Date(0),
    ...overrides,
  };
}

function makeLogger() {
  return { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
}

/** Fake Context carrying just what adminExists reads off it. */
function makeFakeContext(users: FakeUser[]): Context<AppEnv> {
  const db = makeFakeDb(users);
  return {
    get: (key: string) => (key === "db" ? db : undefined),
  } as unknown as Context<AppEnv>;
}

/** Mounts adminRouter with a fake `db`/caller identity injected via
 * middleware - mirrors how it's actually wired (app.ts sets `db`/`logger`/
 * `userId`/`_role`), without needing a real D1 binding. */
function buildApp(opts: {
  userId?: string | null;
  users: FakeUser[];
  logger: ReturnType<typeof makeLogger>;
  staleFirstRoleScan?: boolean;
}) {
  const app = new Hono<AppEnv>();
  const db = makeFakeDb(opts.users, {
    staleFirstRoleScan: opts.staleFirstRoleScan,
  });
  app.use(async (c, next) => {
    if (opts.userId) c.set("userId", opts.userId);
    c.set("db", db as never);
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
    const users = [
      makeUser({ id: "u1", role: "foreman" }),
      makeUser({ id: "u2", role: "manager" }),
    ];
    await expect(adminExists(makeFakeContext(users))).resolves.toBe(false);
  });

  it("returns true when an explicit admin role exists", async () => {
    const users = [
      makeUser({ id: "u1", role: "foreman" }),
      makeUser({ id: "u2", role: "admin" }),
    ];
    await expect(adminExists(makeFakeContext(users))).resolves.toBe(true);
  });

  it("treats an unset (default foreman) role as non-admin, never as admin-by-default", async () => {
    const users = [makeUser({ id: "u1", role: "foreman" })];
    await expect(adminExists(makeFakeContext(users))).resolves.toBe(false);
  });
});

describe("GET /admin/bootstrap-status", () => {
  it("rejects an unauthenticated caller", async () => {
    const app = buildApp({ userId: null, users: [], logger: makeLogger() });

    const res = await app.request("/admin/bootstrap-status");

    expect(res.status).toBe(401);
  });

  it("reports adminExists from the database", async () => {
    const users = [makeUser({ id: "u1", role: "admin" })];
    const app = buildApp({ userId: "user_1", users, logger: makeLogger() });

    const res = await app.request("/admin/bootstrap-status", {}, makeEnv());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      adminExists: true,
      justBootstrapped: false,
    });
  });

  it("auto-bootstraps the caller on a genuinely admin-less workspace, with no separate click", async () => {
    const users = [makeUser({ id: "user_1", role: "foreman" })];
    const app = buildApp({ userId: "user_1", users, logger: makeLogger() });

    const res = await app.request("/admin/bootstrap-status", {}, makeEnv());

    expect(users[0].role).toBe("admin");
    await expect(res.json()).resolves.toEqual({
      adminExists: true,
      justBootstrapped: true,
    });
  });

  it("does not auto-bootstrap a caller who doesn't match BOOTSTRAP_ADMIN_EMAIL", async () => {
    const users = [
      makeUser({
        id: "stranger",
        role: "foreman",
        email: "stranger@example.com",
      }),
    ];
    const app = buildApp({ userId: "stranger", users, logger: makeLogger() });

    const res = await app.request(
      "/admin/bootstrap-status",
      {},
      makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com" }),
    );

    expect(users[0].role).toBe("foreman");
    await expect(res.json()).resolves.toEqual({
      adminExists: false,
      justBootstrapped: false,
    });
  });

  it("does not attempt bootstrap when an admin already exists (no wasted write)", async () => {
    const users = [makeUser({ id: "existing_admin", role: "admin" })];
    const app = buildApp({ userId: "user_1", users, logger: makeLogger() });

    const res = await app.request("/admin/bootstrap-status", {}, makeEnv());

    expect(users).toHaveLength(1);
    await expect(res.json()).resolves.toEqual({
      adminExists: true,
      justBootstrapped: false,
    });
  });
});

describe("POST /admin/bootstrap", () => {
  it("rejects an unauthenticated caller", async () => {
    const app = buildApp({ userId: null, users: [], logger: makeLogger() });

    const res = await app.request("/admin/bootstrap", { method: "POST" });

    expect(res.status).toBe(401);
  });

  it("promotes the caller to admin on a genuinely admin-less workspace", async () => {
    const users = [makeUser({ id: "user_1", role: "foreman" })];
    const app = buildApp({ userId: "user_1", users, logger: makeLogger() });

    const res = await app.request(
      "/admin/bootstrap",
      { method: "POST" },
      makeEnv(),
    );

    expect(users[0].role).toBe("admin");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("refuses to bootstrap when an admin already exists (409)", async () => {
    const users = [
      makeUser({ id: "user_1", role: "foreman" }),
      makeUser({ id: "existing_admin", role: "admin" }),
    ];
    const app = buildApp({ userId: "user_1", users, logger: makeLogger() });

    const res = await app.request(
      "/admin/bootstrap",
      { method: "POST" },
      makeEnv(),
    );

    expect(users[0].role).toBe("foreman");
    expect(res.status).toBe(409);
  });

  describe("BOOTSTRAP_ADMIN_EMAIL restriction", () => {
    it("warns when a bootstrap is attempted with BOOTSTRAP_ADMIN_EMAIL unset", async () => {
      const logger = makeLogger();
      const users = [makeUser({ id: "user_1", role: "foreman" })];
      const app = buildApp({ userId: "user_1", users, logger });

      await app.request("/admin/bootstrap", { method: "POST" }, makeEnv());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("BOOTSTRAP_ADMIN_EMAIL is not set"),
      );
    });

    it("does not warn when BOOTSTRAP_ADMIN_EMAIL is set", async () => {
      const logger = makeLogger();
      const users = [
        makeUser({ id: "user_1", role: "foreman", email: "owner@example.com" }),
      ];
      const app = buildApp({ userId: "user_1", users, logger });

      await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com" }),
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("allows bootstrap for the configured email", async () => {
      const users = [
        makeUser({ id: "user_1", role: "foreman", email: "owner@example.com" }),
      ];
      const app = buildApp({ userId: "user_1", users, logger: makeLogger() });

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com" }),
      );

      expect(users[0].role).toBe("admin");
      await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("matches the configured email case-insensitively", async () => {
      const users = [
        makeUser({ id: "user_1", role: "foreman", email: "OWNER@EXAMPLE.COM" }),
      ];
      const app = buildApp({ userId: "user_1", users, logger: makeLogger() });

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "Owner@Example.com" }),
      );

      await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("rejects a caller whose email doesn't match BOOTSTRAP_ADMIN_EMAIL (land-grab prevention)", async () => {
      const users = [
        makeUser({
          id: "attacker",
          role: "foreman",
          email: "attacker@evil.com",
        }),
      ];
      const app = buildApp({ userId: "attacker", users, logger: makeLogger() });

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv({ BOOTSTRAP_ADMIN_EMAIL: "owner@example.com" }),
      );

      expect(users[0].role).toBe("foreman");
      expect(res.status).toBe(403);
    });
  });

  describe("TOCTOU race handling", () => {
    // attemptBootstrap() stamps `updatedAt: new Date()` on every admin-role
    // write, so simulating "who committed first" means controlling the
    // wall clock the route's own `new Date()` calls observe, via fake
    // timers - not just pre-seeding arbitrary fixed timestamps that real
    // code would immediately overwrite.
    afterEach(() => {
      vi.useRealTimers();
    });

    it("lets the deterministic winner (earliest updatedAt) of a detected race keep admin", async () => {
      // The racer already committed its (losing) write at t=200 before this
      // test starts.
      const users = [
        makeUser({ id: "user_winner", role: "foreman" }),
        makeUser({ id: "user_racer", role: "admin", updatedAt: new Date(200) }),
      ];
      const app = buildApp({
        userId: "user_winner",
        users,
        logger: makeLogger(),
        // Simulates this caller's adminExists() pre-check running before
        // the racer's already-committed write became visible to it - the
        // TOCTOU window itself. Without this, the pre-check would see the
        // racer and bail out with 409 before ever reaching the race logic
        // this test exercises.
        staleFirstRoleScan: true,
      });

      // This caller's own write lands earlier in wall-clock time (t=100)
      // than the racer's already-committed write (t=200), so it wins the
      // tie-break despite the race.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(100));

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv(),
      );

      await expect(res.json()).resolves.toEqual({ ok: true });
      expect(users[0].role).toBe("admin");
    });

    it("demotes the losing racer back to its prior role and reports 409", async () => {
      // The other caller already committed its (winning) write at t=100
      // before this test starts.
      const users = [
        makeUser({ id: "user_loser", role: "manager" }),
        makeUser({
          id: "user_winner",
          role: "admin",
          updatedAt: new Date(100),
        }),
      ];
      const app = buildApp({
        userId: "user_loser",
        users,
        logger: makeLogger(),
      });

      // This caller's own write lands later in wall-clock time (t=500)
      // than the already-committed winner's, so it loses the tie-break and
      // must demote itself back to its prior role ("manager").
      vi.useFakeTimers();
      vi.setSystemTime(new Date(500));

      const res = await app.request(
        "/admin/bootstrap",
        { method: "POST" },
        makeEnv(),
      );

      expect(res.status).toBe(409);
      expect(users[0].role).toBe("manager");
    });
  });
});
