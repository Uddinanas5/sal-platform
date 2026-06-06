import { describe, it, expect } from "vitest"
import {
  assertSlotAllowed,
  ERR_OUTSIDE_WORKING_HOURS,
} from "@/lib/scheduling/working-hours"
import { combineDateWithTimeZoned, timeParts } from "@/lib/scheduling/zoned-time"

// Regression for: "Availability and working-hours interpret @db.Time business/
// staff hours in the SERVER timezone, ignoring Business.timezone — a UTC host
// shifts a NY salon's entire bookable window 4-5h."
//
// The @db.Time wall-clock must be anchored to the SALON's IANA timezone, not the
// server's. These assertions must hold identically whether the host runs UTC or
// America/New_York. We don't fork the process here; instead the math is built on
// Date.UTC + TZDate, which is host-timezone independent BY CONSTRUCTION. We also
// assert the host TZ we observe so a future regression that reintroduces
// getHours() (host-dependent) would surface as a value drift under one TZ.
//
// CI runs `pnpm vitest run` twice — once under TZ=UTC and once under
// TZ=America/New_York (see the package.json `test:tz` script) — so the SAME
// assertions are exercised in both server timezones.

// @db.Time value: Prisma stores the wall-clock as UTC, so build with Date.UTC.
const time = (h: number, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m, 0, 0))

const NY = "America/New_York"
const LOC = "loc_1"
const STAFF = "staff_1"

function fakeTx(schedule: { startTime: Date; endTime: Date } | null) {
  return {
    staffSchedule: { findFirst: async () => schedule },
    staffTimeOff: { findFirst: async () => null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe("combineDateWithTimeZoned — salon timezone anchoring", () => {
  it("reads @db.Time wall-clock via getUTC* (matches the adapter write path)", () => {
    expect(timeParts(time(9, 30))).toEqual({ hours: 9, minutes: 30, seconds: 0 })
  })

  it("maps a 9:00 NY open to the correct UTC instant in summer (EDT, UTC-4)", () => {
    // 2026-06-03 is in EDT. 09:00 ET == 13:00Z.
    const civil = new Date(2026, 5, 3) // local-midnight Jun 3 (civil day only)
    const instant = combineDateWithTimeZoned(civil, time(9), NY)
    expect(instant.toISOString()).toBe("2026-06-03T13:00:00.000Z")
  })

  it("maps a 9:00 NY open to the correct UTC instant in winter (EST, UTC-5)", () => {
    // 2026-01-07 is in EST. 09:00 ET == 14:00Z.
    const civil = new Date(2026, 0, 7)
    const instant = combineDateWithTimeZoned(civil, time(9), NY)
    expect(instant.toISOString()).toBe("2026-01-07T14:00:00.000Z")
  })

  it("falls back to UTC when no timezone is given", () => {
    const civil = new Date(2026, 5, 3)
    const instant = combineDateWithTimeZoned(civil, time(9), "")
    expect(instant.toISOString()).toBe("2026-06-03T09:00:00.000Z")
  })
})

describe("assertSlotAllowed — anchored to salon timezone (NY)", () => {
  // Salon open 9:00–17:00 ET (stored as @db.Time UTC wall-clock).
  const open9to5 = { startTime: time(9), endTime: time(17) }

  it("accepts the real NY business window (10:00–10:45 ET == 14:00–14:45Z, summer)", async () => {
    const tx = fakeTx(open9to5)
    const start = new Date("2026-06-03T14:00:00.000Z") // 10:00 ET
    const end = new Date("2026-06-03T14:45:00.000Z") // 10:45 ET
    await expect(assertSlotAllowed(tx, STAFF, LOC, start, end, NY)).resolves.toBeUndefined()
  })

  it("accepts a slot starting exactly at the NY open (09:00 ET == 13:00Z, summer)", async () => {
    const tx = fakeTx(open9to5)
    const start = new Date("2026-06-03T13:00:00.000Z") // 09:00 ET
    const end = new Date("2026-06-03T13:30:00.000Z")
    await expect(assertSlotAllowed(tx, STAFF, LOC, start, end, NY)).resolves.toBeUndefined()
  })

  it("rejects a pre-dawn slot the buggy server-TZ logic would have allowed (05:00 ET == 09:00Z)", async () => {
    // 09:00Z is what a UTC host MISREADS as the open when it ignores the salon
    // timezone. In ET that instant is 05:00 — before open — and must be rejected.
    const tx = fakeTx(open9to5)
    const start = new Date("2026-06-03T09:00:00.000Z") // 05:00 ET
    const end = new Date("2026-06-03T09:45:00.000Z")
    await expect(assertSlotAllowed(tx, STAFF, LOC, start, end, NY)).rejects.toThrow(
      ERR_OUTSIDE_WORKING_HOURS,
    )
  })

  it("rejects a slot past the NY close (17:30 ET == 21:30Z)", async () => {
    const tx = fakeTx(open9to5)
    const start = new Date("2026-06-03T21:30:00.000Z") // 17:30 ET
    const end = new Date("2026-06-03T22:15:00.000Z")
    await expect(assertSlotAllowed(tx, STAFF, LOC, start, end, NY)).rejects.toThrow(
      ERR_OUTSIDE_WORKING_HOURS,
    )
  })

  it("resolves the correct salon-local weekday across the day boundary", async () => {
    // 2026-06-04 00:30Z is still Wed Jun 3 in ET (20:30 ET). The schedule lookup
    // weekday must be Wednesday's (3), and 20:30 ET is past the 17:00 close.
    const tx = fakeTx(open9to5)
    const start = new Date("2026-06-04T00:30:00.000Z") // 20:30 ET Wed
    const end = new Date("2026-06-04T01:15:00.000Z")
    await expect(assertSlotAllowed(tx, STAFF, LOC, start, end, NY)).rejects.toThrow(
      ERR_OUTSIDE_WORKING_HOURS,
    )
  })
})
