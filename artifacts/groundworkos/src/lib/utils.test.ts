import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatCurrency,
  formatCurrencyFull,
  formatDate,
  formatDateShort,
  daysUntil,
  daysOverdue,
  getMonday,
} from "./utils";

// These are the functions behind every expiry warning in the app (RAMS,
// insurance, CSCS/NRSWA cards - see SubcontractorsPage.tsx's
// getDocWarnings and DocumentsPage's equivalent) and every money figure on
// a quote, invoice or report. Getting the date-boundary and rounding
// behaviour wrong here doesn't crash - it silently shows the wrong "days
// until expiry" or the wrong amount, which is worse.

describe("formatCurrency", () => {
  it("formats whole pounds with no decimal places", () => {
    expect(formatCurrency(1234)).toBe("£1,234");
  });

  it("rounds rather than truncates fractional pounds", () => {
    expect(formatCurrency(1234.5)).toBe("£1,235");
    expect(formatCurrency(1234.4)).toBe("£1,234");
  });

  it("formats zero and negative amounts", () => {
    expect(formatCurrency(0)).toBe("£0");
    expect(formatCurrency(-50)).toBe("-£50");
  });
});

describe("formatCurrencyFull", () => {
  it("always shows two decimal places", () => {
    expect(formatCurrencyFull(1234.5)).toBe("£1,234.50");
    expect(formatCurrencyFull(0)).toBe("£0.00");
  });

  it("does not round away the pence the way formatCurrency does", () => {
    expect(formatCurrencyFull(99.999)).toBe("£100.00");
    expect(formatCurrencyFull(99.994)).toBe("£99.99");
  });
});

describe("formatDate / formatDateShort", () => {
  it("renders an em-dash for a missing date rather than 'Invalid Date'", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDateShort(null)).toBe("—");
  });

  it("formats a valid ISO date in UK day-month-year order", () => {
    expect(formatDate("2026-03-05")).toBe("05 Mar 2026");
    expect(formatDateShort("2026-03-05")).toBe("05 Mar");
  });
});

describe("daysUntil", () => {
  afterEach(() => vi.useRealTimers());

  it("returns null for a missing date", () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
  });

  it("returns 0 for today, not off-by-one in either direction", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T14:30:00"));
    expect(daysUntil("2026-06-15")).toBe(0);
  });

  it("returns a negative count for a date already in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T09:00:00"));
    expect(daysUntil("2026-06-10")).toBe(-5);
  });

  it("counts forward correctly across a month boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T09:00:00"));
    expect(daysUntil("2026-07-03")).toBe(5);
  });

  it("ignores time-of-day on both ends (whole calendar days only)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T23:59:00"));
    expect(daysUntil("2026-06-16")).toBe(1);
  });
});

describe("daysOverdue", () => {
  afterEach(() => vi.useRealTimers());

  it("returns 0 for a missing date", () => {
    expect(daysOverdue(null)).toBe(0);
  });

  it("returns 0 for a date that isn't overdue yet, never negative", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T09:00:00"));
    expect(daysOverdue("2026-06-20")).toBe(0);
  });

  it("returns 0 for a due date of today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T09:00:00"));
    expect(daysOverdue("2026-06-15")).toBe(0);
  });

  it("counts whole days overdue for a past due date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T09:00:00"));
    expect(daysOverdue("2026-06-10")).toBe(5);
  });
});

describe("getMonday", () => {
  it("returns the same date when given a Monday", () => {
    // 2026-06-15 is a Monday.
    const monday = getMonday(new Date("2026-06-15T12:00:00"));
    expect(monday.getDate()).toBe(15);
  });

  it("rolls back to the previous Monday for a mid-week date", () => {
    // 2026-06-18 is a Thursday.
    const monday = getMonday(new Date("2026-06-18T12:00:00"));
    expect(monday.getDate()).toBe(15);
    expect(monday.getMonth()).toBe(5); // June (0-indexed)
  });

  it("rolls back across a week boundary for a Sunday, not forward", () => {
    // 2026-06-21 is a Sunday - JS's getDay() === 0, the case the function
    // special-cases (day === 0 ? -6 : 1) to avoid jumping to *next*
    // Monday.
    const monday = getMonday(new Date("2026-06-21T12:00:00"));
    expect(monday.getDate()).toBe(15);
  });

  it("rolls back across a month boundary correctly", () => {
    // 2026-07-01 is a Wednesday; the Monday of that week is 2026-06-29.
    const monday = getMonday(new Date("2026-07-01T12:00:00"));
    expect(monday.getMonth()).toBe(5);
    expect(monday.getDate()).toBe(29);
  });
});
