import { describe, expect, it, vi } from "vitest";

// generateId.ts imports `db` from @workspace/db at module scope, and that
// module throws at import time unless DATABASE_URL is set. generateId()
// itself never touches the database, so mock it out rather than requiring a
// real connection string for this test.
vi.mock("@workspace/db", () => ({ db: { execute: vi.fn() } }));

const { generateId } = await import("./generateId");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateId", () => {
  it("returns a random UUID", () => {
    expect(generateId()).toMatch(UUID_RE);
  });

  it("returns a fresh id on every call", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });

  it("never persists a client-supplied id — the generator takes no input and ignores any it's given", () => {
    const clientSuppliedId = "client-chosen-id-that-must-never-be-used";
    // generateId() takes no parameters. Cast around that to prove that even
    // a caller mistakenly threading a client-supplied value through has no
    // effect: the result is always freshly server-generated, never the
    // value that was passed in.
    const id = (generateId as unknown as (clientId?: string) => string)(
      clientSuppliedId,
    );
    expect(id).not.toBe(clientSuppliedId);
    expect(id).toMatch(UUID_RE);
  });
});
