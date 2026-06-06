import { describe, it, expect, beforeEach, vi } from "vitest"

// Regression for the availability READ path: getAvailability must anchor a
// salon's @db.Time working hours to Business.timezone, so a 9am NY salon
// produces slot instants at 13:00Z (EDT) on any host — UTC or otherwise. Before
// the fix, combineDateWithTime used getHours/setHours (server-local), so a UTC
// host generated slots at 09:00Z (= 05:00 ET).
//
// Mock-Prisma (vi.hoisted) — no DB. CI runs this file under TZ=UTC AND
// TZ=America/New_York (see package.json `test:tz`), exercising the same
// assertions in both server timezones.

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

// @db.Time wall-clock stored as UTC by Prisma — build with Date.UTC.
const time = (h: number, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m, 0, 0))
const NY = "America/New_York"

beforeEach(() => {
  vi.clearAllMocks()
  // 30-min service, no buffers.
  prismaMock.service.findUnique.mockResolvedValue({
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
  })
  // Staff works 9–17, no breaks.
  prismaMock.staffSchedule.findFirst.mockResolvedValue({
    startTime: time(9),
    endTime: time(17),
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
  // Business hours 9–17.
  prismaMock.businessHours.findFirst.mockResolvedValue({
    isClosed: false,
    openTime: time(9),
    closeTime: time(17),
  })
})

describe("getAvailability — salon timezone anchoring (summer / EDT)", () => {
  // Use a far-future date so the same-day lead-time branch never trims slots,
  // keeping the assertion deterministic regardless of when the suite runs.
  const civil = new Date(2099, 5, 3) // local-midnight Jun 3 2099 (civil day)

  it("first slot of a 9am NY salon is 13:00Z (09:00 ET), not 09:00Z", async () => {
    const result = await getAvailability({
      staffId: "s1",
      serviceId: "svc1",
      date: civil,
      locationId: "loc1",
      timezone: NY,
    })
    expect(result.slots.length).toBeGreaterThan(0)
    expect(result.slots[0].start.toISOString()).toBe("2099-06-03T13:00:00.000Z")
    // Last 30-min slot must end by 17:00 ET == 21:00Z → starts 20:30Z (16:30 ET).
    expect(result.slots[result.slots.length - 1].start.toISOString()).toBe(
      "2099-06-03T20:30:00.000Z",
    )
    // The returned date key is the salon-local civil day.
    expect(result.date).toBe("2099-06-03")
  })

  it("falls back to a UTC window when no timezone is supplied", async () => {
    const result = await getAvailability({
      staffId: "s1",
      serviceId: "svc1",
      date: civil,
      locationId: "loc1",
    })
    expect(result.slots[0].start.toISOString()).toBe("2099-06-03T09:00:00.000Z")
  })

  it("the slot LABEL renders in the salon timezone (9:00 AM, not 1:00 PM)", async () => {
    const result = await getAvailability({
      staffId: "s1",
      serviceId: "svc1",
      date: civil,
      locationId: "loc1",
      timezone: NY,
    })
    // Mirror /api/availability/route.ts formatTime(slot.start, timezone).
    const label = result.slots[0].start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: NY,
    })
    expect(label).toBe("9:00 AM")
  })
})
