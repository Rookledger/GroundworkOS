import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * D1 bindings only exist per-request (`c.env.DB` inside a Hono handler) -
 * there is no module-level connection object the way `pg.Pool` used to be.
 * Callers construct a scoped Drizzle instance once per request (see the
 * `db` middleware in apps' `app.ts`) and either pass it down explicitly or
 * stash it on the request context; nothing in this package holds a
 * module-level `db` singleton any more.
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;

export * from "./schema";
