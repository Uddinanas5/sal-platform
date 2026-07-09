import { describe, it, expect, vi, beforeEach } from "vitest"
import { combineDateWithTimeZoned } from "@/lib/scheduling/zoned-time"

// L-007 — METAMORPHIC tests for the availability engine. Instead of asserting an
// exact slot list (a brittle snapshot), these assert RELATIONS that must hold for
// ANY correct implementation, run against the REAL getAvailability with the 6 DB
// reads mocked (5 fixed, only the appointments vary). No live DB, no production
// change. The base window (09:00–17:00, 60-min service, 15-min grid) yields 29
// slots, so every relation below is non-vacuous.
//
// Relations locked:
//   R1  adding an existing appointment can only REMOVE slots (result ⊆ base) — the
//       booking-safety monotonicity that underpins "never double-book".
//   R2  no offered slot ever overlaps a blocked appointment.
//   R3  a LONGER service can only reduce slots (result ⊆ base, |result| ≤ |base|).
//   R4  NARROWING the working window can only remove slots (result ⊆ base).

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    service: { findUnique: vi.fn() },
    staffSchedule: { findFirst: vi.fn() },
    staffTimeOff: { findMany: vi.fn() },
    appointmentService: { findMany: vi.fn() },
    staff: { findUnique: vi.fn() },
    businessHours: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { getAvailability } from "@/lib/availability"

const TZ = "UTC"
// Far-future date so the "today" lead-time branch never fires → deterministic.
const Y = 2030, MO = 5, D = 15
const civil = new Date(Y, MO, D)
const dbTime = (h: number, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m)) // a @db.Time value
const at = (h: number, m = 0) => combineDateWithTimeZoned(civil, dbTime(h, m), TZ) // absolute instant

// Mutable per-test config; defaults describe a plain 09:00–17:00 day, 60-min service.
let cfg: {
  duration: number
  open: [number, number]
  close: [number, number]
  appts: Array<{ startTime: Date; endTime: Date; durationMinutes: number }>
}

beforeEach(() => {
  cfg = { duration: 60, open: [9, 0], close: [17, 0], appts: [] }
  prismaMock.service.findUnique.mockImplementation(async () => ({
    durationMinutes: cfg.duration,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
  }))
  prismaMock.staffSchedule.findFirst.mockImplementation(async () => ({
    startTime: dbTime(9, 0),
    endTime: dbTime(17, 0),
    breaks: [],
  }))
  prismaMock.staffTimeOff.findMany.mockResolvedValue([])
  prismaMock.appointmentService.findMany.mockImplementation(async () => cfg.appts)
  prismaMock.staff.findUnique.mockResolvedValue({
    bookingBufferMinutes: 0,
    canAcceptBookings: true,
    isActive: true,
    deletedAt: null,
  })
  prismaMock.businessHours.findFirst.mockImplementation(async () => ({
    isClosed: false,
    openTime: dbTime(cfg.open[0], cfg.open[1]),
    closeTime: dbTime(cfg.close[0], cfg.close[1]),
  }))
})

const run = () =>
  getAvailability({ staffId: "s1", serviceId: "svc1", date: civil, locationId: "loc1", timezone: TZ })
const startSet = (r: { slots: Array<{ start: Date }> }) => new Set(r.slots.map((s) => s.start.toISOString()))
const isSubset = (a: Set<string>, b: Set<string>) => Array.from(a).every((x) => b.has(x))

describe("availability metamorphic relations (L-007)", () => {
  it("baseline is non-vacuous (a full 09:00–17:00 day yields many 60-min slots)", async () => {
    const base = await run()
    expect(base.slots.length).toBe(29) // 09:00 … 16:00 on a 15-min grid
  })

  it("R1: adding an existing appointment only REMOVES slots (result ⊆ base, strictly fewer)", async () => {
    const base = await run()
    cfg.appts = [{ startTime: at(12, 0), endTime: at(13, 0), durationMinutes: 60 }]
    const blocked = await run()

    expect(isSubset(startSet(blocked), startSet(base))).toBe(true)
    expect(blocked.slots.length).toBeLessThan(base.slots.length)
    expect(blocked.slots.length).toBeGreaterThan(0)
  })

  it("R1b: MORE appointments ⇒ fewer-or-equal slots (monotonic)", async () => {
    cfg.appts = [{ startTime: at(12, 0), endTime: at(13, 0), durationMinutes: 60 }]
    const one = await run()
    cfg.appts = [
      { startTime: at(12, 0), endTime: at(13, 0), durationMinutes: 60 },
      { startTime: at(15, 0), endTime: at(16, 0), durationMinutes: 60 },
    ]
    const two = await run()

    expect(isSubset(startSet(two), startSet(one))).toBe(true)
    expect(two.slots.length).toBeLessThanOrEqual(one.slots.length)
  })

  it("R2: no offered slot overlaps a blocked appointment", async () => {
    cfg.appts = [{ startTime: at(12, 0), endTime: at(13, 0), durationMinutes: 60 }]
    const r = await run()
    const bStart = at(12, 0).getTime()
    const bEnd = at(13, 0).getTime()
    for (const slot of r.slots) {
      const overlaps = slot.start.getTime() < bEnd && slot.end.getTime() > bStart
      expect(overlaps).toBe(false)
    }
  })

  it("R3: a LONGER service can only reduce availability (result ⊆ base, fewer-or-equal)", async () => {
    const base = await run()
    cfg.duration = 120
    const longer = await run()

    expect(isSubset(startSet(longer), startSet(base))).toBe(true)
    expect(longer.slots.length).toBeLessThanOrEqual(base.slots.length)
  })

  it("R4: NARROWING the working window can only remove slots (result ⊆ base)", async () => {
    const base = await run()
    cfg.open = [10, 0]
    cfg.close = [16, 0]
    const narrow = await run()

    expect(isSubset(startSet(narrow), startSet(base))).toBe(true)
    expect(narrow.slots.length).toBeLessThan(base.slots.length)
    expect(narrow.slots.length).toBeGreaterThan(0)
  })
})
