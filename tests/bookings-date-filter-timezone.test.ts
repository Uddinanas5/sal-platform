import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Booking audit L-030: GET /api/bookings built its date filter from SERVER-local
// midnight (parseYmd + setHours) instead of the salon timezone, so ?date=YYYY-MM-DD
// selected a UTC-shifted window — near midnight a non-UTC salon's list showed the
// wrong day's appointments. It now computes day bounds in the salon zone (matching
// /api/v1/appointments). Drives the real GET handler over mocked auth + prisma.

const { getBusinessContext, businessFindUnique, apptFindMany, apptCount } = vi.hoisted(() => ({
  getBusinessContext: vi.fn(),
  businessFindUnique: vi.fn(),
  apptFindMany: vi.fn(),
  apptCount: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: (...a: unknown[]) => getBusinessContext(...a) }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    business: { findUnique: (...a: unknown[]) => businessFindUnique(...a) },
    appointment: { findMany: (...a: unknown[]) => apptFindMany(...a), count: (...a: unknown[]) => apptCount(...a) },
  },
}))

import { GET } from "@/app/api/bookings/route"

const BIZ = "11111111-1111-4111-8111-111111111111"

// The route is wrapped by withSafeErrors, whose type expects Next's (req, ctx)
// pair. The handler only reads req, so pass an empty route context.
const callGet = (url: string) => GET(new NextRequest(url), undefined as never)

beforeEach(() => {
  vi.clearAllMocks()
  getBusinessContext.mockResolvedValue({ businessId: BIZ, userId: "u1", role: "admin" })
  businessFindUnique.mockResolvedValue({ timezone: "America/New_York" })
  apptFindMany.mockResolvedValue([])
  apptCount.mockResolvedValue(0)
})

describe("GET /api/bookings — date filter windows on the SALON timezone (L-030)", () => {
  it("?date selects the salon's calendar day, not the server's UTC day", async () => {
    const res = await callGet("http://localhost/api/bookings?date=2026-06-15")
    expect(res.status).toBe(200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = (apptFindMany.mock.calls[0]![0] as any).where
    // 2026-06-15 in America/New_York (EDT, UTC-4) = [04:00Z, next-day 03:59:59.999Z].
    expect(where.startTime.gte.toISOString()).toBe("2026-06-15T04:00:00.000Z")
    expect(where.startTime.lte.toISOString()).toBe("2026-06-16T03:59:59.999Z")
  })

  it("rejects an impossible calendar date (2026-06-31) with 400", async () => {
    const res = await callGet("http://localhost/api/bookings?date=2026-06-31")
    expect(res.status).toBe(400)
  })

  it("does not fetch the timezone (no query) when there is no date filter", async () => {
    const res = await callGet("http://localhost/api/bookings")
    expect(res.status).toBe(200)
    expect(businessFindUnique).not.toHaveBeenCalled()
  })
})
