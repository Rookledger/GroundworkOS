import type { Database } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * `crypto.randomUUID()` is a Web Crypto global available natively on
 * Workers - no `node:crypto` import needed.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Atomically allocates the next sequence number for a given table/year using
 * a dedicated counters table. `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
 * is supported by D1's underlying SQLite engine the same way it was by
 * Postgres, so this logic is unchanged - only the caller-supplied executor
 * type changed, since there is no module-level `db` singleton to default to
 * any more (D1 only exists per-request, as `c.env.DB`). Every call site now
 * passes its request-scoped `db` (or an open transaction/batch handle)
 * explicitly.
 */
export async function nextSeqNumber(
  db: Pick<Database, "run" | "get" | "all">,
  tableName: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${tableName}:${year}`;
  const row = await db.get<{ value: number }>(sql`
    INSERT INTO id_counters (key, value)
    VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = id_counters.value + 1
    RETURNING value
  `);
  const value = Number(row?.value ?? 1);
  const n = value.toString().padStart(3, "0");
  return `${prefix}-${year}-${n}`;
}
