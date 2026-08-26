import { defineConfig } from "drizzle-kit";
import path from "path";

/**
 * D1 migrations are generated here (plain SQL, dialect "sqlite") and then
 * applied with Wrangler against a named D1 database - `wrangler d1
 * migrations apply <DB_NAME>` (local) or `--remote` (production) - run from
 * artifacts/api-server, which owns the wrangler.jsonc that declares the D1
 * binding and migrations directory. This config's only job is `generate`;
 * it never talks to a live database itself (no `push` against D1 - see
 * package.json, which drops the push/push-force scripts the Postgres setup
 * had).
 */
export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
