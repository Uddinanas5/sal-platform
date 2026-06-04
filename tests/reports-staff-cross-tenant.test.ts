import { describe, it, expect, beforeEach, vi } from "vitest"

// Guards the cross-tenant report leak (P0): getStaffPerformanceById must scope
// the staff lookup by BOTH the route's staff id AND the caller's businessId (via
// primaryLocation), so it can never resolve a barber from another shop. It must
// also read REAL earned commission from the Commission ledger — never a
// hardcoded percentage estimate. Mocks prisma — no DB.

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    staff: { findFirst: vi.fn() },
    appointmentService: { aggregate: vi.fn() },
    review: { aggregate: vi.fn() },
    commission: { aggregate: vi.fn() },
  }
  return { prismaMock }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { getStaffPerformanceById } from "@/lib/queries/reports"

const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"
const STAFF = "22222222-2222-4222-8222-222222222222"

beforeEach(() => {
  vi.clearAllMocks()
  // Default aggregates (empty ledger / no revenue).
  prismaMock.appointmentService.aggregate.mockResolvedValue({
    _sum: { finalPrice: 0 },
    _count: 0,
  })
  prismaMock.review.aggregate.mockResolvedValue({ _avg: { overallRating: 0 } })
  prismaMock.commission.aggregate.mockResolvedValue({
    _sum: { commissionAmount: 0 },
  })
})

describe("getStaffPerformanceById — tenant isolation", () => {
  it("scopes the staff lookup by BOTH staff id and businessId", async () => {
    prismaMock.staff.findFirst.mockResolvedValue({
      id: STAFF,
      user: { firstName: "Jamie", lastName: "Lee" },
    })

    await getStaffPerformanceById(STAFF, BIZ)

    expect(prismaMock.staff.findFirst).toHaveBeenCalledTimes(1)
    const arg = prismaMock.staff.findFirst.mock.calls[0][0]
    // Id AND business must both be in the where clause — id alone or name alone
    // would allow cross-tenant resolution.
    expect(arg.where.id).toBe(STAFF)
    expect(arg.where.primaryLocation).toEqual({ businessId: BIZ })
  })

  it("returns null when the staff id does not belong to the caller's business", async () => {
    // Simulates findFirst not matching because the id+businessId pair has no row.
    prismaMock.staff.findFirst.mockResolvedValue(null)

    const result = await getStaffPerformanceById(STAFF, OTHER_BIZ)

    expect(result).toBeNull()
    // No further per-staff aggregation should run on a miss.
    expect(prismaMock.appointmentService.aggregate).not.toHaveBeenCalled()
    expect(prismaMock.commission.aggregate).not.toHaveBeenCalled()
  })

  it("returns null without querying when businessId is missing (no fallback)", async () => {
    // An empty businessId is still a valid string arg; the runtime guard
    // (`if (!staffId || !businessId) return null`) must short-circuit before any query.
    const result = await getStaffPerformanceById(STAFF, "")
    expect(result).toBeNull()
    expect(prismaMock.staff.findFirst).not.toHaveBeenCalled()
  })

  it("reads commission from the ledger, not a percentage estimate", async () => {
    prismaMock.staff.findFirst.mockResolvedValue({
      id: STAFF,
      user: { firstName: "Jamie", lastName: "Lee" },
    })
    // Revenue is $1000 but the ledger only earned $42.50 — a percentage estimate
    // would never produce 42.5, proving we read the real ledger.
    prismaMock.appointmentService.aggregate.mockResolvedValue({
      _sum: { finalPrice: 1000 },
      _count: 8,
    })
    prismaMock.review.aggregate.mockResolvedValue({ _avg: { overallRating: 4.6 } })
    prismaMock.commission.aggregate.mockResolvedValue({
      _sum: { commissionAmount: 42.5 },
    })

    const result = await getStaffPerformanceById(STAFF, BIZ)

    expect(result).toEqual({
      name: "Jamie Lee",
      appointments: 8,
      revenue: 1000,
      rating: 4.6,
      commission: 42.5,
    })
    // The commission aggregate is scoped to the verified staff.id.
    const cArg = prismaMock.commission.aggregate.mock.calls[0][0]
    expect(cArg.where.staffId).toBe(STAFF)
  })

  it("honestly reports $0 commission when the ledger is empty", async () => {
    prismaMock.staff.findFirst.mockResolvedValue({
      id: STAFF,
      user: { firstName: "Jamie", lastName: "Lee" },
    })
    prismaMock.appointmentService.aggregate.mockResolvedValue({
      _sum: { finalPrice: 500 },
      _count: 4,
    })
    // Empty ledger → null sum.
    prismaMock.commission.aggregate.mockResolvedValue({
      _sum: { commissionAmount: null },
    })

    const result = await getStaffPerformanceById(STAFF, BIZ)
    expect(result?.commission).toBe(0)
  })
})
