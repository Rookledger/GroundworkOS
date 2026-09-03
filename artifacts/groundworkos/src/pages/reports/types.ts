/**
 * Shared types/constants for the Reports page and its per-tab modules
 * (see the sibling files in this directory). Split out of ReportsPage.tsx
 * (tech-debt audit finding #14) as the shared vocabulary every tab's data
 * hook and presentational component needs, so none of them has to import
 * from ReportsPage.tsx itself.
 */

export type ReportTab = "overview" | "pl" | "cis" | "ratebook";

// Chart palette shared across every tab. Named for what each represents in
// this codebase's chosen accent scheme, not literal color names - GREEN is
// always "good"/collected, RED is always "bad"/overdue, matching the CSS
// custom properties they're paired with at each call site.
export const YELLOW = "var(--accent)";
export const RED = "var(--danger)";
export const GREEN = "#2a6e45";
export const ORANGE = "var(--warning)";
export const BLUE = "var(--accent)";

export const TYPE_COLORS = [
  "var(--accent)",
  "var(--warning)",
  "#2a6e45",
  "var(--ink-2)",
  "var(--muted)",
  "var(--border)",
  "var(--danger)",
  "var(--surface-3)",
];
