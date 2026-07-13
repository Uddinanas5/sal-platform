import { describe, it, expect } from "vitest"
import { maxAdvanceDateKey, localDateString } from "@/lib/scheduling/zoned-time"

// Booking audit L-029: the public booking / reschedule advance-booking ceiling
// ("up to N days in advance") was built from the SERVER's local day, while the
// availability read-path anchors to the salon's local day. For a salon AHEAD of
// UTC (e.g. Dubai, UTC+4), during the daily window where the salon's date is a day
// ahead of the server's, a boundary-date slot the widget just offered was rejected
// on write. The ceiling now uses maxAdvanceDateKey (salon-local), matching the
// read-path. Pure helper test.

describe("maxAdvanceDateKey — ceiling anchored to the SALON's local day (L-029)", () => {
  it("uses the salon's local today, not the server's (Dubai UTC+4 boundary)", () => {
    // 2026-07-09 01:00 Asia/Dubai === 2026-07-08 21:00Z. Salon-local today is 07-09.
    const now = new Date("2026-07-08T21:00:00Z")
    expect(maxAdvanceDateKey(30, "Asia/Dubai", now)).toBe("2026-08-08")
    // Server-local (UTC) would anchor to 07-08 → 08-07: one day earlier — the bug.
    expect(maxAdvanceDateKey(30, "UTC", now)).toBe("2026-08-07")
  })

  it("allows a slot ON the boundary salon-local day and rejects the next day", () => {
    const now = new Date("2026-07-08T21:00:00Z") // 2026-07-09 in Dubai
    const maxKey = maxAdvanceDateKey(30, "Asia/Dubai", now) // 2026-08-08
    // A 10 AM Dubai slot on the boundary day (06:00Z) is WITHIN the window.
    expect(localDateString(new Date("2026-08-08T06:00:00Z"), "Asia/Dubai") <= maxKey).toBe(true)
    // The day after is OUT of the window.
    expect(localDateString(new Date("2026-08-09T06:00:00Z"), "Asia/Dubai") > maxKey).toBe(true)
  })

  it("rolls over month/year correctly in the salon zone", () => {
    // 30 days from 2026-12-20 (10 AM New York, EST) → 2027-01-19.
    const now = new Date("2026-12-20T15:00:00Z")
    expect(maxAdvanceDateKey(30, "America/New_York", now)).toBe("2027-01-19")
  })
})
