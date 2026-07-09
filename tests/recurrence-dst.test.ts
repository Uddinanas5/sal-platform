import { describe, it, expect } from "vitest"
import { generateRecurrenceDates } from "@/lib/scheduling/recurrence"

// Booking audit L-025/L-026: recurring series must keep the same SALON-LOCAL
// wall-clock time across a DST boundary (and 'monthly' must be same-day-next-month,
// not a flat 30 days). US spring-forward 2026 is Sunday March 8. A 9:00 AM
// America/New_York series is 14:00Z in EST and 13:00Z in EDT. Pure helper test.

const NY = "America/New_York"

describe("generateRecurrenceDates — salon-timezone anchored (DST-safe)", () => {
  it("keeps a weekly 9:00 AM NY appointment at 9:00 AM local across spring-forward", () => {
    // 2026-03-02 09:00 EST === 14:00Z
    const dates = generateRecurrenceDates({
      start: new Date("2026-03-02T14:00:00Z"),
      rule: "weekly",
      endDate: new Date("2026-03-23T23:59:59Z"),
      timezone: NY,
    })

    expect(dates.map((d) => d.toISOString())).toEqual([
      "2026-03-02T14:00:00.000Z", // 9:00 AM EST
      "2026-03-09T13:00:00.000Z", // 9:00 AM EDT (after DST) — NOT 14:00Z
      "2026-03-16T13:00:00.000Z",
      "2026-03-23T13:00:00.000Z",
    ])
  })

  it("advances 'monthly' by calendar month (same day, DST-adjusted), not a flat 30 days", () => {
    // 2026-01-15 09:00 EST === 14:00Z
    const dates = generateRecurrenceDates({
      start: new Date("2026-01-15T14:00:00Z"),
      rule: "monthly",
      endDate: new Date("2026-03-31T23:59:59Z"),
      timezone: NY,
    })

    // Feb 15 (still EST, 14:00Z) and Mar 15 (EDT after Mar 8, 13:00Z) — day-of-month
    // 15 preserved and 9:00 AM local, which a flat +30 days would NOT produce.
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2026-01-15T14:00:00.000Z",
      "2026-02-15T14:00:00.000Z",
      "2026-03-15T13:00:00.000Z",
    ])
  })

  it("respects the max cap and the endDate ceiling", () => {
    const capped = generateRecurrenceDates({
      start: new Date("2026-06-01T13:00:00Z"),
      rule: "weekly",
      endDate: new Date("2027-01-01T00:00:00Z"),
      timezone: NY,
      max: 5,
    })
    expect(capped).toHaveLength(5)

    const short = generateRecurrenceDates({
      start: new Date("2026-06-01T13:00:00Z"),
      rule: "weekly",
      endDate: new Date("2026-06-10T00:00:00Z"), // only 06-01 and 06-08 fit
      timezone: NY,
    })
    expect(short).toHaveLength(2)
  })
})
