import { describe, it, expect } from "vitest"
import { parseYmd } from "@/lib/date-utils"

// Regression coverage for the date-overflow guard wired into /api/bookings and
// /api/availability. Before the fix, `new Date('2026-06-31')` silently rolled
// to July 1, shifting query windows by a day on impossible input. parseYmd must
// REJECT impossible/malformed dates rather than coerce them.
describe("parseYmd", () => {
  it("accepts a valid date and returns local midnight of that day", () => {
    const d = parseYmd("2026-06-15")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(5) // June (0-indexed)
    expect(d!.getDate()).toBe(15)
    expect(d!.getHours()).toBe(0)
  })

  it("rejects impossible calendar days that JS would silently roll forward", () => {
    // These are the exact cases from Tester's matrix.
    expect(parseYmd("2026-02-30")).toBeNull() // Feb 30 -> would roll to Mar 2
    expect(parseYmd("2026-04-31")).toBeNull() // Apr 31 -> would roll to May 1
    expect(parseYmd("2026-09-31")).toBeNull() // Sep 31 -> would roll to Oct 1
    expect(parseYmd("2026-06-31")).toBeNull() // the original bug
  })

  it("rejects out-of-range months", () => {
    expect(parseYmd("2026-13-01")).toBeNull()
    expect(parseYmd("2026-00-10")).toBeNull()
  })

  it("rejects malformed shapes", () => {
    expect(parseYmd("2026/06/15")).toBeNull() // slashes, not dashes
    expect(parseYmd("2026-6-15")).toBeNull()  // unpadded month
    expect(parseYmd("not-a-date")).toBeNull()
    expect(parseYmd("")).toBeNull()
    expect(parseYmd("2026-13-45")).toBeNull()
  })

  it("accepts a real leap day and rejects a fake one", () => {
    expect(parseYmd("2028-02-29")).not.toBeNull() // 2028 is a leap year
    expect(parseYmd("2027-02-29")).toBeNull()     // 2027 is not
  })
})
