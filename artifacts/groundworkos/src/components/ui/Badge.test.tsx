import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders the mapped label for a known status", () => {
    render(<Badge status="paid" />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("falls back to the raw status string for an unmapped status rather than crashing", () => {
    render(<Badge status="some_future_status" />);
    expect(screen.getByText("some_future_status")).toBeInTheDocument();
  });

  it("prefers an explicit label override while still using status for styling", () => {
    render(<Badge status="paid" label="Custom label" />);
    expect(screen.getByText("Custom label")).toBeInTheDocument();
    expect(screen.queryByText("Paid")).not.toBeInTheDocument();
  });
});
