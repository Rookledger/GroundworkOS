#!/usr/bin/env node
/**
 * Applies pending Drizzle migrations under a Postgres session-level
 * advisory lock, using drizzle-orm's *programmatic* migrator rather than
 * shelling out to the `drizzle-kit` CLI.
 *
 * Why an advisory lock: railway.json's deploy.startCommand runs
 * `pnpm --filter @workspace/db run migrate` on every container start,
 * before the API server boots. With more than one replica (or two deploys
 * racing during a rollout) this means multiple migration runs could hit the
 * same database at the same time, with nothing serialising them. This
 * script wraps the migration in `pg_advisory_lock` / `pg_advisory_unlock`,
 * both scoped to a single fixed key. Only one process across the whole
 * Postgres instance can hold the lock at a time, so concurrent container
 * starts serialise: the first one applies the migration, the rest block
 * until it finishes and then run the migrator themselves against an
 * already-up-to-date database, which is a no-op (drizzle tracks applied
 * migrations in `drizzle.__drizzle_migrations` and skips anything already
 * applied). The lock is released in a `finally` block so it is always
 * freed, whether the migration succeeds or fails.
 *
 * Why the programmatic migrator instead of the `drizzle-kit` CLI:
 * `drizzle-kit` is a devDependency of @workspace/db. Running it at
 * container start only works today because railway.json's buildCommand
 * uses `--prod=false`, so devDependencies happen to still be present in
 * node_modules when the container boots - nothing about the *runtime* path
 * requires that, so a future change to the build step (e.g. a prune step,
 * or switching to a leaner install) could silently break `pnpm run
 * migrate` at start time. `drizzle-orm/node-postgres/migrator` reads the
 * same `./migrations/*.sql` files and writes to the same
 * `drizzle.__drizzle_migrations` tracking table as the CLI, but ships as
 * part of `drizzle-orm`, which is a real runtime dependency of this
 * package. That removes the devDependency-at-runtime coupling entirely -
 * no subprocess, no dependency on `drizzle-kit` (or even `pnpm`) being
 * resolvable on PATH at container start.
 *
 * `drizzle-kit` itself is untouched and stays a devDependency - it's still
 * what `generate`/`push`/`push-force` use for local/dev workflows, none of
 * which run at deploy time.
 *
 * This script exits non-zero on any migration failure (thrown errors from
 * `migrate()` propagate to `main().catch`), so
 * `pnpm --filter @workspace/db run migrate && node .../index.mjs` still
 * fails and still prevents the server from booting - same property the
 * plain `&&` gave us before.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Client } = pg;

// Fixed, arbitrary 63-bit key for this lock. Any int64 works as long as it
// stays stable across deploys (Postgres advisory locks are keyed purely by
// this number, scoped to the whole database cluster - not to a table or
// schema). Picked once and should not be changed casually, since changing
// it just means old and new processes stop contending for the same lock.
const ADVISORY_LOCK_KEY = "8743217643089631";

const dbPackageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const migrationsFolder = path.join(dbPackageRoot, "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  // Dedicated connection just for holding the session-level advisory lock.
  // pg_advisory_lock/unlock are tied to the *session* (this connection), so
  // this must be a single long-lived Client, not a Pool.
  const lockClient = new Client({ connectionString: databaseUrl });
  await lockClient.connect();

  // Separate, single-use connection for actually applying the migrations.
  // Kept independent of the lock connection so the migrator's own
  // transaction/session usage can't interfere with holding the lock.
  const migrationClient = new Client({ connectionString: databaseUrl });
  await migrationClient.connect();
  const db = drizzle(migrationClient);

  try {
    process.stdout.write(
      `[migrate] waiting for advisory lock (${ADVISORY_LOCK_KEY})...\n`,
    );
    await lockClient.query("select pg_advisory_lock($1::bigint)", [
      ADVISORY_LOCK_KEY,
    ]);
    process.stdout.write("[migrate] lock acquired, applying migrations...\n");

    await migrate(db, { migrationsFolder });

    process.stdout.write("[migrate] migrations applied successfully.\n");
  } finally {
    try {
      await lockClient.query("select pg_advisory_unlock($1::bigint)", [
        ADVISORY_LOCK_KEY,
      ]);
      process.stdout.write("[migrate] lock released.\n");
    } catch (unlockError) {
      // Not fatal to the overall exit code: the session ending will also
      // release the lock. But surface it, since a failure here could mean
      // something odd happened to the connection.
      process.stderr.write(
        `[migrate] warning: failed to explicitly release advisory lock: ${unlockError}\n`,
      );
    } finally {
      await lockClient.end();
      await migrationClient.end();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[migrate] fatal error:", error);
    process.exit(1);
  });
