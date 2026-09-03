import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  // React logs the caught error to the console by default (on top of this
  // component's own componentDidCatch); silence that noise for this file
  // rather than suppressing it globally.
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  afterEach(() => {
    consoleError.mockClear();
  });

  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("catches a render error from a child and shows the fallback instead of crashing the tree", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("surfaces the thrown error's message in the collapsible details", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
