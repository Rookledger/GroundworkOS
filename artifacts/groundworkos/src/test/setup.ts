import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @testing-library/react's automatic per-test cleanup relies on detecting
// a global `afterEach` (Jest sets one up automatically); this project runs
// with Vitest's `globals` left off (matching the rest of the workspace, so
// `describe`/`it`/`expect` stay explicit imports everywhere), so it has to
// be registered by hand here instead - otherwise each render() leaks into
// the next test's DOM and queries like getByText start matching multiple
// stale elements.
afterEach(() => {
  cleanup();
});
