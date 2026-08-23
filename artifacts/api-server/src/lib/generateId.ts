import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export function generateId(): string {
  return randomUUID();
}

/**
 * Atomically allocates the next sequence number for a given table/year using
 * a dedicated counters table. Uses INSERT ... ON CONFLICT DO UPDATE, which
 * takes a row-level lock in Postgres, so concurrent callers are serialized
 * and cannot receive the same number (unlike the previous COUNT(*)+1 scheme).
 *
 * Accepts an optional `executor` (a transaction handle) so callers that need
 * the number allocation to roll back together with other writes (e.g. quote
 * + line items) can pass their `tx` instead of using the module-level `db`.
 */
export async function nextSeqNumber(
  tableName: string,
  prefix: string,
  executor: Pick<typeof db, "execute"> = db,
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${tableName}:${year}`;
  const result = await executor.execute(sql`
    INSERT INTO id_counters (key, value)
    VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = id_counters.value + 1
    RETURNING value
  `);
  const row = (result as any).rows?.[0] ?? (result as any)[0];
  const value = Number(row?.value ?? 1);
  const n = value.toString().padStart(3, "0");
  return `${prefix}-${year}-${n}`;
}
