import { describe, expect, it } from "vitest";
import { buildCspDirectives } from "./csp";

describe("buildCspDirectives", () => {
  it("produces a locked-down, same-origin-only policy", () => {
    const directives = buildCspDirectives();

    expect(directives["default-src"]).toEqual(["'self'"]);
    expect(directives["script-src"]).toEqual(["'self'"]);
    expect(directives["connect-src"]).toEqual(["'self'"]);
    expect(directives["frame-src"]).toEqual(["'self'"]);
    expect(directives["frame-ancestors"]).toEqual(["'none'"]);
    expect(directives["object-src"]).toEqual(["'none'"]);
  });

  it("still allows blob:/data: where the app itself needs them (image previews, workers)", () => {
    const directives = buildCspDirectives();

    expect(directives["img-src"]).toEqual(
      expect.arrayContaining(["'self'", "data:", "blob:"]),
    );
    expect(directives["worker-src"]).toEqual(
      expect.arrayContaining(["'self'", "blob:", "data:"]),
    );
  });

  it("allows inline styles (style-src) needed by the current UI stack", () => {
    const directives = buildCspDirectives();

    expect(directives["style-src"]).toEqual(
      expect.arrayContaining(["'self'", "'unsafe-inline'"]),
    );
  });
});
