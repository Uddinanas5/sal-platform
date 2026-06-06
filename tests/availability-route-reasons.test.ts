import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// GROUP: availability-route reason codes + soft-delete/activation filters.
// /api/availability must (a) hide soft-deleted/offline services and removed or
// not-accepting staff, and (b) tag the empty case with a machine-readable
// `reason` so the public client can gate the Join-Waitlist CTA to genuinely
// full days. Mock-Prisma (vi.hoisted) + a stubbed availability engine — no DB.

const { prismaMock, getMultiStaffAvailabilityMock, getSettingsMock } = vi.hoisted(() => ({
  prismaMock: {
    service: { findUnique: vi.fn() },
    location: { findFirst: vi.fn() },
    staff: { findMany: vi.fn() },
  },
  getMultiStaffAvailabilityMock: vi.fn(),
  getSettingsMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/availability", () => ({ getMultiStaffAvailability: getMultiStaffAvailabilityMock }))
vi.mock("@/lib/actions/booking-settings", () => ({ getPublicBookingSettings: getSettingsMock }))

import { GET } from "@/app/api/availability/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const SERVICE = "22222222-2222-4222-8222-222222222222"
const LOC = "55555555-5555-4555-8555-555555555555"
const STAFF = "33333333-3333-4333-8333-333333333333"

function ymdPlus(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function get(params: Record<string, string>) {
  const u = new URL("http://localhost/api/availability")
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
  // The route reads request.nextUrl.searchParams, so a NextRequest is required.
  // withSafeErrors's handler signature is (req, ctx) — pass an empty ctx.
  return GET(new NextRequest(u.toString()), undefined as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  getSettingsMock.mockResolvedValue({ minLeadTime: "none", maxAdvanceBooking: "1m" })
  prismaMock.service.findUnique.mockResolvedValue({
    businessId: BIZ,
    durationMinutes: 30,
    business: { timezone: "UTC" },
  })
  prismaMock.location.findFirst.mockResolvedValue({ id: LOC })
})

describe("/api/availability — service soft-delete filter", () => {
  it("returns SERVICE_NOT_FOUND for a soft-deleted/offline service", async () => {
    // The hardened findUnique (isActive/isOnlineBooking/deletedAt:null) returns null.
    prismaMock.service.findUnique.mockResolvedValue(null)
    const res = await get({ serviceId: SERVICE, date: ymdPlus(5), locationId: LOC })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("SERVICE_NOT_FOUND")
    // The where clause carries the activation/soft-delete filters.
    const where = prismaMock.service.findUnique.mock.calls[0][0].where
    expect(where.isActive).toBe(true)
    expect(where.isOnlineBooking).toBe(true)
    expect(where.deletedAt).toBe(null)
  })
})

describe("/api/availability — reason codes", () => {
  it("reason 'no_staff' when no staff perform the service at this location", async () => {
    prismaMock.staff.findMany.mockResolvedValue([])
    const res = await get({ serviceId: SERVICE, date: ymdPlus(5), locationId: LOC })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slots).toEqual([])
    expect(body.reason).toBe("no_staff")
    // The all-staff branch filters isActive/deletedAt/canAcceptBookings.
    const where = prismaMock.staff.findMany.mock.calls[0][0].where
    expect(where.isActive).toBe(true)
    expect(where.deletedAt).toBe(null)
    expect(where.canAcceptBookings).toBe(true)
  })

  it("reason 'fully_booked' when staff exist but every slot is taken", async () => {
    prismaMock.staff.findMany.mockResolvedValue([
      { id: STAFF, user: { firstName: "Sam", lastName: "Cutter", avatarUrl: null } },
    ])
    // Engine returns no slots for the day → genuinely full.
    getMultiStaffAvailabilityMock.mockResolvedValue(
      new Map([[STAFF, { slots: [], serviceDuration: 30 }]]),
    )
    const res = await get({ serviceId: SERVICE, date: ymdPlus(5), locationId: LOC })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slots).toEqual([])
    expect(body.reason).toBe("fully_booked")
  })

  it("no reason field when slots are available", async () => {
    prismaMock.staff.findMany.mockResolvedValue([
      { id: STAFF, user: { firstName: "Sam", lastName: "Cutter", avatarUrl: null } },
    ])
    const start = new Date("2099-06-03T13:00:00.000Z")
    const end = new Date("2099-06-03T13:30:00.000Z")
    getMultiStaffAvailabilityMock.mockResolvedValue(
      new Map([[STAFF, { slots: [{ start, end }], serviceDuration: 30 }]]),
    )
    const res = await get({ serviceId: SERVICE, date: ymdPlus(5), locationId: LOC })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slots.length).toBe(1)
    expect(body.reason).toBeUndefined()
  })

  it("explicit not-accepting/removed staffId resolves to STAFF_NOT_FOUND (filter present)", async () => {
    prismaMock.staff.findMany.mockResolvedValue([])
    const res = await get({ serviceId: SERVICE, date: ymdPlus(5), locationId: LOC, staffId: STAFF })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("STAFF_NOT_FOUND")
    const where = prismaMock.staff.findMany.mock.calls[0][0].where
    expect(where.id).toBe(STAFF)
    expect(where.isActive).toBe(true)
    expect(where.deletedAt).toBe(null)
    expect(where.canAcceptBookings).toBe(true)
  })

  it("out-of-window date returns OUT_OF_BOOKING_WINDOW (not a waitlist-able reason)", async () => {
    const res = await get({ serviceId: SERVICE, date: ymdPlus(200), locationId: LOC })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("OUT_OF_BOOKING_WINDOW")
  })
})
