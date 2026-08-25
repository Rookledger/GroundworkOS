/**
 * Minimal structured logger, replacing pino.
 *
 * pino's default transport writes to a Node stream (and pino-pretty spawns
 * a worker thread) - neither exists on a V8 isolate. Workers' own
 * `console.log`/`console.error` already ship each call as a structured line
 * to the Cloudflare dashboard/Tail/Logpush, so the simplest correct thing is
 * a thin wrapper that keeps the same call shape every route already uses
 * (`logger.info({ err }, "message")`) and JSON-serializes the fields itself.
 *
 * Keeps the same redaction behaviour as the old pino config: known-sensitive
 * fields are stripped before serializing, wherever they appear in the
 * object.
 */

type LogFields = Record<string, unknown>;

const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "accesstoken",
  "refreshtoken",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: LogFields = {};
  for (const [key, v] of Object.entries(value as LogFields)) {
    out[key] = REDACTED_KEYS.has(key.toLowerCase())
      ? "[redacted]"
      : redact(v, depth + 1);
  }
  return out;
}

function write(
  level: "info" | "warn" | "error" | "debug",
  fieldsOrMsg: LogFields | string,
  maybeMsg?: string,
): void {
  const hasFields = typeof fieldsOrMsg !== "string";
  const fields = hasFields ? (redact(fieldsOrMsg) as LogFields) : undefined;
  const msg = hasFields ? maybeMsg : fieldsOrMsg;
  const line = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(fields ?? {}),
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export interface Logger {
  info(fields: LogFields, msg?: string): void;
  info(msg: string): void;
  warn(fields: LogFields, msg?: string): void;
  warn(msg: string): void;
  error(fields: LogFields, msg?: string): void;
  error(msg: string): void;
  debug(fields: LogFields, msg?: string): void;
  debug(msg: string): void;
}

export const logger: Logger = {
  info: (a: LogFields | string, b?: string) => write("info", a, b),
  warn: (a: LogFields | string, b?: string) => write("warn", a, b),
  error: (a: LogFields | string, b?: string) => write("error", a, b),
  debug: (a: LogFields | string, b?: string) => write("debug", a, b),
};
