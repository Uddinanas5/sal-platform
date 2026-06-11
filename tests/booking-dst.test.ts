import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  combineDateWithTimeZoned,
  dayBoundsInZone,
  startOfDayInZone,
  localDateString,
} from "@/lib/scheduling/zoned-time"

// 3D BOOKING PROOF (1/2) — DST correctness for America/New_York.
//
// Proves time handling is correct across the two US DST transitions, which are
// the classic places a salon-timezone booking system silently corrupts slots:
//
//   • SPRING-FORWARD (Sun Mar 8 2026): the wall-clock jumps 02:00 -> 03:00, so
//     the local hour 02:00-02:59 DOES NOT EXIST. A naive "+24h" day or a
//     getHours()-based combine would either land a slot in that hole or shift
//     the whole window. The salon day is only 23h long.
//   • FALL-BACK (Sun Nov 1 2026): the wall-clock repeats 01:00-01:59, so the
//     salon day is 25h long. A fixed "+24h" end-of-day would drop the extra
//     repeated hour's appointments out of a day-window query.
//
// We assert the REAL zoned-time helpers (combineDateWithTimeZoned / day bounds)
// produce the correct ABSOLUTE UTC instants, and that the availability slot
// generator (getAvailability) never offers a slot whose wall-clock falls in the
// non-existent spring-forward hour. Mock-Prisma where a DB read is needed.
//
// Host-independence: every assertion is on the absolute UTC timeline (built from
// TZDate + Date.UTC), so it holds identically under TZ=UTC and
// TZ=America/New_York. CI runs this file under BOTH via `npm run test:tz`
// (package.json: `TZ=UTC vitest run && TZ=America/New_York vitest run`).

// --- mock-Prisma for getAvailability (no DB) ---------------------------------
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    service: { findUnique: vi.fn() },
    staffSchedule: { findFirst: vi.fn() },
    staffTimeOff: { findFirst: vi.fn() },
    appointmentService: { findMany: vi.fn() },
    staff: { findUnique: vi.fn() },
    businessHours: { findFirst: vi.fn() },
  }
  return { prismaMock }
})
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { getAvailability } from "@/lib/availability"

const NY = "America/New_York"

// A `@db.Time` wall-clock: Prisma stores it pinned to 1970-01-01 at UTC, so the
// builder mirrors the adapter write path with Date.UTC (NOT a local Date).
const time = (h: number, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m, 0, 0))

// The salon-local wall-clock an absolute instant renders as in NY (24h).
const wallClockNY = (instant: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant)

// ===========================================================================
// 1. combineDateWithTimeZoned — correct UTC instants across the transitions
// ===========================================================================
describe("combineDateWithTimeZoned — DST transition instants (NY)", () => {
  // Spring-forward day: Sun Mar 8 2026. Before 02:00 it is EST (UTC-5); from
  // 03:00 it is EDT (UTC-4).
  const SPRING = new Date(2026, 2, 8) // local-midnight civil day Mar 8 2026

  it("maps a pre-gap 01:30 (EST, UTC-5) to the correct UTC instant", () => {
    const inst = combineDateWithTimeZoned(SPRING, time(1, 30), NY)
    expect(inst.toISOString()).toBe("2026-03-08T06:30:00.000Z")
    expect(wallClockNY(inst)).toBe("01:30")
  })

  it("maps a post-gap 03:00 (EDT, UTC-4) to the correct UTC instant", () => {
    const inst = combineDateWithTimeZoned(SPRING, time(3), NY)
    expect(inst.toISOString()).toBe("2026-03-08T07:00:00.000Z")
    expect(wallClockNY(inst)).toBe("03:00")
  })

  it("a NON-EXISTENT 02:30 wall-clock never resolves to a 02:xx local instant", () => {
    // 02:00-02:59 does not exist on the spring-forward day. The helper rolls the
    // request forward into EDT rather than fabricating a 02:xx instant — so the
    // resulting instant renders as 03:xx, never 02:xx.
    const inst = combineDateWithTimeZoned(SPRING, time(2, 30), NY)
    expect(wallClockNY(inst)).not.toMatch(/^02:/)
    expect(wallClockNY(inst)).toBe("03:30")
    expect(inst.toISOString()).toBe("2026-03-08T07:30:00.000Z")
  })

  it("the gap collapses: 02:00 and 03:00 wall-clocks map to the SAME UTC instant", () => {
    // Because 02:00 doesn't exist, it rolls forward to 03:00 EDT — the same
    // absolute instant 03:00 EDT already occupies. Proves there is no phantom
    // hour of bookable time inside the gap.
    const at0200 = combineDateWithTimeZoned(SPRING, time(2), NY)
    const at0300 = combineDateWithTimeZoned(SPRING, time(3), NY)
    expect(at0200.toISOString()).toBe("2026-03-08T07:00:00.000Z")
    expect(at0200.getTime()).toBe(at0300.getTime())
  })

  // Fall-back day: Sun Nov 1 2026. EDT (UTC-4) before the repeat, EST (UTC-5)
  // after. The 01:00-01:59 wall-clock occurs twice.
  const FALL = new Date(2026, 10, 1) // local-midnight civil day Nov 1 2026

  it("maps fall-back 00:30 (EDT, UTC-4) and 02:30 (EST, UTC-5) to correct instants", () => {
    const before = combineDateWithTimeZoned(FALL, time(0, 30), NY)
    const after = combineDateWithTimeZoned(FALL, time(2, 30), NY)
    expect(before.toISOString()).toBe("2026-11-01T04:30:00.000Z") // 00:30 EDT
    expect(after.toISOString()).toBe("2026-11-01T07:30:00.000Z") // 02:30 EST
    expect(wallClockNY(before)).toBe("00:30")
    expect(wallClockNY(after)).toBe("02:30")
  })

  it("the repeated 01:30 wall-clock resolves deterministically (first/EDT occurrence)", () => {
    // 01:30 happens twice on fall-back; the helper must pick one occurrence
    // deterministically (not throw / not drift by host). It picks the first
    // (EDT, UTC-4) occurrence: 05:30Z.
    const inst = combineDateWithTimeZoned(FALL, time(1, 30), NY)
    expect(inst.toISOString()).toBe("2026-11-01T05:30:00.000Z")
    expect(wallClockNY(inst)).toBe("01:30")
  })

  it("a 9:00 salon open resolves correctly on each transition day", () => {
    // Sanity: the actual business-open instant on each day.
    expect(combineDateWithTimeZoned(SPRING, time(9), NY).toISOString()).toBe(
      "2026-03-08T13:00:00.000Z", // 09:00 EDT
    )
    expect(combineDateWithTimeZoned(FALL, time(9), NY).toISOString()).toBe(
      "2026-11-01T14:00:00.000Z", // 09:00 EST
    )
  })
})

// ===========================================================================
// 2. Day boundaries — 23h spring day, 25h fall day (DST-correct windowing)
// ===========================================================================
describe("availability day boundaries — DST-correct UTC instants", () => {
  it("spring-forward salon day is 23 hours (midnight-to-next-midnight, not +24h)", () => {
    const anySpringInstant = new Date("2026-03-08T18:00:00.000Z")
    const start = startOfDayInZone(anySpringInstant, NY)
    const { start: bStart, end } = dayBoundsInZone(anySpringInstant, NY)

    // Salon-local midnight Mar 8 is 05:00Z (still EST, UTC-5).
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z")
    expect(bStart.getTime()).toBe(start.getTime())
    // Inclusive end is 1ms before the NEXT salon-local midnight, which is
    // 04:00Z Mar 9 (now EDT, UTC-4) => end = 03:59:59.999Z.
    expect(end.toISOString()).toBe("2026-03-09T03:59:59.999Z")

    // The day is 23h long — the gap hour is genuinely gone.
    const lengthHours = (end.getTime() + 1 - start.getTime()) / 3_600_000
    expect(lengthHours).toBe(23)
    // The end still belongs to the same salon-local calendar day.
    expect(localDateString(end, NY)).toBe("2026-03-08")
  })

  it("fall-back salon day is 25 hours (the repeated hour is not dropped)", () => {
    const anyFallInstant = new Date("2026-11-01T18:00:00.000Z")
    const start = startOfDayInZone(anyFallInstant, NY)
    const { end } = dayBoundsInZone(anyFallInstant, NY)

    // Salon-local midnight Nov 1 is 04:00Z (still EDT, UTC-4).
    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z")
    // Next salon-local midnight is 05:00Z Nov 2 (now EST, UTC-5) => end 1ms before.
    expect(end.toISOString()).toBe("2026-11-02T04:59:59.999Z")

    const lengthHours = (end.getTime() + 1 - start.getTime()) / 3_600_000
    expect(lengthHours).toBe(25)
    expect(localDateString(end, NY)).toBe("2026-11-01")
  })
})

// ===========================================================================
// 3. getAvailability — no slot lands in the non-existent spring-forward hour
// ===========================================================================
describe("getAvailability — no slot in the non-existent spring-forward hour (NY)", () => {
  // A staff schedule that fully spans the transition: 00:00-06:00 NY on the
  // spring-forward day. If the generator were timezone-naive it would emit a
  // slot at 02:00 / 02:30 local (which doesn't exist) or skip a real hour.
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.service.findUnique.mockResolvedValue({
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    })
    prismaMock.staffSchedule.findFirst.mockResolvedValue({
      startTime: time(0),
      endTime: time(6),
      breaks: [],
    })
    prismaMock.staffTimeOff.findFirst.mockResolvedValue(null)
    prismaMock.appointmentService.findMany.mockResolvedValue([])
    prismaMock.staff.findUnique.mockResolvedValue({
      bookingBufferMinutes: 0,
      canAcceptBookings: true,
      isActive: true,
      deletedAt: null,
    })
    prismaMock.businessHours.findFirst.mockResolvedValue({
      isClosed: false,
      openTime: time(0),
      closeTime: time(6),
    })
  })

  // Use a FAR-FUTURE spring-forward Sunday (Mar 8 2099 — same second-Sunday DST
  // rule, verified a Sunday with the identical 02:00->03:00 gap) so the same-day
  // lead-time branch never trims slots and the assertion is date-stable.
  const SPRING_FUTURE = new Date(2099, 2, 8)

  it("offers no slot whose NY wall-clock is in the 02:00-02:59 gap", async () => {
    const result = await getAvailability({
      staffId: "s1",
      serviceId: "svc1",
      date: SPRING_FUTURE,
      locationId: "loc1",
      timezone: NY,
    })

    expect(result.slots.length).toBeGreaterThan(0)
    const labels = result.slots.map((s) => wallClockNY(s.start))
    // The non-existent local hour must be entirely absent.
    expect(labels.some((l) => l.startsWith("02:"))).toBe(false)
    // The window steps straight from 01:45 to 03:00 across the gap.
    expect(labels).toContain("01:45")
    expect(labels).toContain("03:00")
  })

  it("every offered slot is a real instant whose start is strictly monotonic on the absolute timeline", async () => {
    const result = await getAvailability({
      staffId: "s1",
      serviceId: "svc1",
      date: SPRING_FUTURE,
      locationId: "loc1",
      timezone: NY,
    })
    const times = result.slots.map((s) => s.start.getTime())
    for (let i = 1; i < times.length; i++) {
      // 15-min absolute interval, never a 0-length or backward step (which a
      // local-clock generator would produce when it crossed the spring gap).
      expect(times[i] - times[i - 1]).toBe(15 * 60 * 1000)
    }
  })
})
