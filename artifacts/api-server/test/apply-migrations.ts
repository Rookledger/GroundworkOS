import { applyD1Migrations, env } from "cloudflare:test";

/**
 * `readD1Migrations` (vitest.integration.config.ts) has to run in Node,
 * outside the workerd runtime this pool spins up, to read the migration SQL
 * files off disk - but only code running inside that runtime (imports from
 * "cloudflare:test") can see the `env.DB` binding to apply them against.
 * The config passes the migrations through as the `TEST_MIGRATIONS` binding
 * so this setup file, which does run inside workerd, can apply them once
 * before any integration test touches the database.
 */
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
