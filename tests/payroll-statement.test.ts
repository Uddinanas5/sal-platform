import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the Payday statement query (getPayrollStatement):
//   1. Groups the REAL Commission ledger by staff and sums commissionAmount.
//   2. Is strictly businessId-scoped — every Commission read is constrained to
//      the caller-business's staff ids (staff.primaryLocation.businessId), so a
//      barber from another shop can never be summed into the statement.
//   3. Returns null without querying when businessId is missing (no fallback).
//   4. Surfaces tips/booth-rent as "not yet tracked" instead of fabricating them.
//   5. A payrollPeriodId from another shop resolves to an empty statement, never
//      a widened/unscoped query.
// Mocks prisma — no DB.

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    payrollPeriod: { findFirst: vi.fn(), findMany: vi.fn() },
    staff: { findMany: vi.fn() },
    commission: { findMany: vi.fn() },
    appointmentService: { findMany: vi.fn() },
  }
  return { prismaMock }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { getPayrollStatement, listPayrollPeriods } from "@/lib/queries/payroll"

const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"
const STAFF_A = "22222222-2222-4222-8222-222222222222"
const STAFF_B = "33333333-3333-4333-8333-333333333333"
const FOREIGN_STAFF = "44444444-4444-4444-8444-444444444444"

const RANGE = { from: new Date("2026-05-01"), to: new Date("2026-05-15") }

function staffRow(id: string, first: string, last: string, type = "full_time", rate = 40) {
  return {
    id,
    employmentType: type,
    commissionRate: rate,
    user: { firstName: first, lastName: last },
  }
}

function commissionRow(
  id: string,
  staffId: string,
  gross: number,
  rate: number,
  amount: number,
  type = "service",
) {
  return {
    id,
    staffId,
    type,
    referenceType: "appointment_service",
    referenceId: "as-" + id,
    grossAmount: gross,
    commissionRate: rate,
    commissionAmount: amount,
    status: "pending",
    createdAt: new Date("2026-05-05T15:00:00Z"),
    appointment: {
      bookingReference: "BK-" + id,
      client: { firstName: "Client", lastName: id },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no service-name refs, no appointment services.
  prismaMock.appointmentService.findMany.mockResolvedValue([])
})

describe("getPayrollStatement — grouping & sums", () => {
  it("groups commission rows by staff and sums commissionAmount per barber", async () => {
    prismaMock.staff.findMany.mockResolvedValue([
      staffRow(STAFF_A, "Alex", "Cut"),
      staffRow(STAFF_B, "Bo", "Fade"),
    ])
    // ledger findMany (line items, with referenceType/referenceId selected)
    prismaMock.commission.findMany.mockResolvedValue([
      commissionRow("c1", STAFF_A, 100, 40, 40),
      commissionRow("c2", STAFF_A, 50, 40, 20),
      commissionRow("c3", STAFF_B, 80, 50, 40),
    ])
    prismaMock.appointmentService.findMany.mockResolvedValue([
      { id: "as-c1", name: "Haircut" },
      { id: "as-c2", name: "Beard" },
      { id: "as-c3", name: "Skin Fade" },
    ])

    const result = await getPayrollStatement(BIZ, { range: RANGE })
    expect(result).not.toBeNull()
    const byName = new Map(result!.barbers.map((b) => [b.name, b]))

    const alex = byName.get("Alex Cut")!
    expect(alex.commissionEarned).toBe(60) // 40 + 20
    expect(alex.grossServiceRevenue).toBe(150) // 100 + 50
    expect(alex.commissionedServices).toBe(2)
    expect(alex.totalToPay).toBe(60)
    expect(alex.lineItems.map((l) => l.description)).toEqual(["Haircut", "Beard"])

    const bo = byName.get("Bo Fade")!
    expect(bo.commissionEarned).toBe(40)
    expect(bo.commissionedServices).toBe(1)

    // Grand totals
    expect(result!.totals.commissionEarned).toBe(100) // 60 + 40
    expect(result!.totals.totalToPay).toBe(100)
    expect(result!.totals.commissionedServices).toBe(3)
    expect(result!.totals.barberCount).toBe(2)
  })

  it("includes employmentType + default commissionRate context per barber", async () => {
    prismaMock.staff.findMany.mockResolvedValue([
      staffRow(STAFF_A, "Casey", "Trim", "contractor", 55),
    ])
    prismaMock.commission.findMany.mockResolvedValue([])

    const result = await getPayrollStatement(BIZ, { range: RANGE })
    const barber = result!.barbers[0]
    expect(barber.employmentType).toBe("contractor")
    expect(barber.defaultCommissionRate).toBe(55)
    expect(barber.commissionEarned).toBe(0) // honest $0, no estimate
  })

  it("surfaces tips and booth-rent as not-yet-tracked, never fabricated", async () => {
    prismaMock.staff.findMany.mockResolvedValue([staffRow(STAFF_A, "Dee", "Line")])
    prismaMock.commission.findMany.mockResolvedValue([
      commissionRow("c1", STAFF_A, 200, 40, 80),
    ])

    const result = await getPayrollStatement(BIZ, { range: RANGE })
    expect(result!.notTracked).toEqual({ tips: true, boothRent: true })
    // total-to-pay reflects ONLY recorded commission, no invented tip/rent math
    expect(result!.totals.totalToPay).toBe(80)
  })
})

describe("getPayrollStatement — tenant isolation", () => {
  it("scopes the staff lookup by primaryLocation.businessId", async () => {
    prismaMock.staff.findMany.mockResolvedValue([])
    await getPayrollStatement(BIZ, { range: RANGE })

    expect(prismaMock.staff.findMany).toHaveBeenCalledTimes(1)
    const arg = prismaMock.staff.findMany.mock.calls[0][0]
    expect(arg.where.primaryLocation).toEqual({ businessId: BIZ })
    // When there are no staff for this business, the ledger is never touched.
    expect(prismaMock.commission.findMany).not.toHaveBeenCalled()
  })

  it("constrains every commission read to this business's staff ids", async () => {
    prismaMock.staff.findMany.mockResolvedValue([
      staffRow(STAFF_A, "Alex", "Cut"),
      staffRow(STAFF_B, "Bo", "Fade"),
    ])
    prismaMock.commission.findMany.mockResolvedValue([])

    await getPayrollStatement(BIZ, { range: RANGE })

    // The ledger query must filter staffId IN [this business's staff].
    expect(prismaMock.commission.findMany).toHaveBeenCalledTimes(1)
    const call = prismaMock.commission.findMany.mock.calls[0]
    expect(call[0].where.staffId).toEqual({ in: [STAFF_A, STAFF_B] })
    // and constrained to the window, never unbounded
    expect(call[0].where.createdAt.gte).toBeInstanceOf(Date)
    expect(call[0].where.createdAt.lte).toBeInstanceOf(Date)
  })

  it("never sums a foreign barber's ledger row into the statement", async () => {
    // Only this business's two barbers are resolved.
    prismaMock.staff.findMany.mockResolvedValue([
      staffRow(STAFF_A, "Alex", "Cut"),
      staffRow(STAFF_B, "Bo", "Fade"),
    ])
    // Even if a stray foreign-staff row were returned by the ledger query, it
    // must be dropped (not attributed to any barber in this business).
    prismaMock.commission.findMany.mockResolvedValue([
      commissionRow("c1", STAFF_A, 100, 40, 40),
      commissionRow("x9", FOREIGN_STAFF, 999, 40, 400), // poisoned cross-tenant row
    ])
    prismaMock.appointmentService.findMany.mockResolvedValue([{ id: "as-c1", name: "Haircut" }])

    const result = await getPayrollStatement(BIZ, { range: RANGE })
    // The foreign $400 row is NOT in totals; only the real $40 row counts.
    expect(result!.totals.commissionEarned).toBe(40)
    expect(result!.barbers.every((b) => b.staffId !== FOREIGN_STAFF)).toBe(true)
  })

  it("returns null without querying when businessId is missing (no fallback)", async () => {
    const result = await getPayrollStatement("", { range: RANGE })
    expect(result).toBeNull()
    expect(prismaMock.staff.findMany).not.toHaveBeenCalled()
    expect(prismaMock.commission.findMany).not.toHaveBeenCalled()
  })

  it("rejects a payrollPeriodId from another business (empty statement, no leak)", async () => {
    // findFirst is scoped by {id, businessId}; a foreign period id matches nothing.
    prismaMock.payrollPeriod.findFirst.mockResolvedValue(null)

    const result = await getPayrollStatement(OTHER_BIZ, { payrollPeriodId: "foreign-period" })

    // The period lookup was scoped to the caller's business...
    const arg = prismaMock.payrollPeriod.findFirst.mock.calls[0][0]
    expect(arg.where.id).toBe("foreign-period")
    expect(arg.where.businessId).toBe(OTHER_BIZ)
    // ...and a miss yields an empty, honest statement — never an unscoped query.
    expect(result).not.toBeNull()
    expect(result!.barbers).toEqual([])
    expect(result!.totals.commissionEarned).toBe(0)
    expect(prismaMock.staff.findMany).not.toHaveBeenCalled()
    expect(prismaMock.commission.findMany).not.toHaveBeenCalled()
  })

  it("resolves a valid in-business payroll period and uses its window", async () => {
    prismaMock.payrollPeriod.findFirst.mockResolvedValue({
      id: "p1",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-14"),
    })
    prismaMock.staff.findMany.mockResolvedValue([staffRow(STAFF_A, "Alex", "Cut")])
    prismaMock.commission.findMany.mockResolvedValue([])

    const result = await getPayrollStatement(BIZ, { payrollPeriodId: "p1" })
    expect(result!.payrollPeriodId).toBe("p1")
    // window came from the resolved period
    const apptArg = prismaMock.commission.findMany.mock.calls[0][0]
    expect(apptArg.where.createdAt.gte.toISOString()).toBe(new Date("2026-05-01").toISOString())
  })
})

describe("listPayrollPeriods — tenant scoping", () => {
  it("scopes period listing by businessId and returns empty for missing id", async () => {
    expect(await listPayrollPeriods("")).toEqual([])
    expect(prismaMock.payrollPeriod.findMany).not.toHaveBeenCalled()

    prismaMock.payrollPeriod.findMany.mockResolvedValue([
      {
        id: "p1",
        periodStart: new Date("2026-05-01"),
        periodEnd: new Date("2026-05-14"),
        status: "open",
        paidAt: null,
      },
    ])
    const periods = await listPayrollPeriods(BIZ)
    expect(prismaMock.payrollPeriod.findMany.mock.calls[0][0].where).toEqual({ businessId: BIZ })
    expect(periods[0].id).toBe("p1")
    expect(periods[0].status).toBe("open")
  })
})
