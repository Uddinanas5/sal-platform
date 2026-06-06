import { describe, it, expect, beforeEach, vi } from "vitest"

// Money/report correctness guards (mock Prisma — no DB):
// - Average Ticket uses completed-PAYMENT count, not all (incl. cancelled/no-show)
//   appointments, and on the same Payment.createdAt window as the revenue numerator.
// - serviceRevenue + productRevenue come from line-level rows (AppointmentService /
//   AppointmentProduct), NOT by subtracting a gross product total from a tax+tip
//   inclusive payment total. A product sale now contributes to product revenue.
// - Revenue-by-Category + Payment-Methods honour the picker range (not all-time).
// - Staff Performance revenue is derived from the Commission ledger so it ties to
//   the Commission column (same window, type:"service").

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    payment: { aggregate: vi.fn(), groupBy: vi.fn() },
    appointment: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    client: { count: vi.fn() },
    appointmentService: { aggregate: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    appointmentProduct: { aggregate: vi.fn() },
    staff: { findMany: vi.fn() },
    review: { groupBy: vi.fn() },
    commission: { groupBy: vi.fn() },
  }
  return { prismaMock }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import {
  getReportSummary,
  getRevenueByCategory,
  getRevenueByPaymentMethod,
  getStaffPerformance,
} from "@/lib/queries/reports"

const BIZ = "11111111-1111-4111-8111-111111111111"
const STAFF = "22222222-2222-4222-8222-222222222222"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getReportSummary — avg ticket + line-level service/product revenue", () => {
  beforeEach(() => {
    // Current window payment agg: $1000 collected over 4 completed PAYMENTS.
    // amount (pre-tax/tip) 900, tips 50 → tax = 1000 - 900 - 50 = 50.
    prismaMock.payment.aggregate
      .mockResolvedValueOnce({
        _sum: { totalAmount: 1000, tipAmount: 50, amount: 900 },
        _count: 4,
      })
      // Previous window: $400 over 2 payments.
      .mockResolvedValueOnce({ _sum: { totalAmount: 400 }, _count: 2 })

    // Appointment counts (all-status booking count) — DELIBERATELY larger than the
    // payment count (10 booked incl. cancelled/no-show). If avg ticket divided by
    // this, it would be 1000/10 = 100, NOT the correct 1000/4 = 250.
    prismaMock.appointment.count
      .mockResolvedValueOnce(10) // currentAppointments
      .mockResolvedValueOnce(5) // lastAppointments

    // newClients / lastNewClients
    prismaMock.client.count
      .mockResolvedValueOnce(3) // newClients
      .mockResolvedValueOnce(2) // lastNewClients
      // retention: totalClientsThisMonth, returningClientsThisMonth
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(4)

    // serviceRevenue from AppointmentService.finalPrice (pre-tax) = 700
    prismaMock.appointmentService.aggregate.mockResolvedValue({ _sum: { finalPrice: 700 } })
    // productRevenue from AppointmentProduct line rows = 200 (NOT $0)
    prismaMock.appointmentProduct.aggregate.mockResolvedValue({ _sum: { totalPrice: 200 } })
  })

  it("divides completed revenue by completed PAYMENT count, excluding cancelled/no-show appointments", async () => {
    const summary = await getReportSummary(BIZ)
    // 1000 / 4 completed payments = 250 (NOT 1000/10 = 100 from all appointments).
    expect(summary.averageTicket).toBe(250)
    // totalAppointments stays the all-status booking count, unchanged.
    expect(summary.totalAppointments).toBe(10)
  })

  it("reports product revenue from line rows and service revenue pre-tax (not by subtraction)", async () => {
    const summary = await getReportSummary(BIZ)
    expect(summary.productRevenue).toBe(200)
    // serviceRevenue is the line-level finalPrice sum, NOT totalRevenue - product
    // (which would be 1000-200 = 800 and would include tax+tip).
    expect(summary.serviceRevenue).toBe(700)
    expect(summary.serviceRevenue).not.toBe(800)
  })

  it("reports tax and tips as their own lines, kept out of service revenue", async () => {
    const summary = await getReportSummary(BIZ)
    expect(summary.tipsCollected).toBe(50)
    expect(summary.taxCollected).toBe(50) // 1000 - 900 - 50
  })

  it("windows the product-revenue aggregate by the Payment ledger (completed + createdAt)", async () => {
    await getReportSummary(BIZ)
    const arg = prismaMock.appointmentProduct.aggregate.mock.calls[0][0]
    // businessId scoping flows through the product relation (standalone sales).
    expect(arg.where.product).toEqual({ businessId: BIZ })
    expect(arg.where.payment.status).toBe("completed")
    expect(arg.where.payment.createdAt).toBeDefined()
  })
})

describe("getRevenueByCategory — honours the picker range", () => {
  it("applies the range window to both the service and product aggregates", async () => {
    prismaMock.appointmentService.findMany.mockResolvedValue([])
    prismaMock.appointmentProduct.aggregate.mockResolvedValue({ _sum: { totalPrice: 0 } })

    const from = new Date("2026-06-01T00:00:00Z")
    const to = new Date("2026-06-30T00:00:00Z")
    await getRevenueByCategory(BIZ, { from, to })

    const svcArg = prismaMock.appointmentService.findMany.mock.calls[0][0]
    expect(svcArg.where.appointment.status).toBe("completed")
    expect(svcArg.where.appointment.startTime).toBeDefined()
    expect(svcArg.where.appointment.startTime.gte).toEqual(from)

    const prodArg = prismaMock.appointmentProduct.aggregate.mock.calls[0][0]
    expect(prodArg.where.product).toEqual({ businessId: BIZ })
    expect(prodArg.where.payment.status).toBe("completed")
    expect(prodArg.where.payment.createdAt).toBeDefined()
  })

  it("stays all-time when no range is supplied (no startTime/createdAt filter)", async () => {
    prismaMock.appointmentService.findMany.mockResolvedValue([])
    prismaMock.appointmentProduct.aggregate.mockResolvedValue({ _sum: { totalPrice: 0 } })

    await getRevenueByCategory(BIZ)

    const svcArg = prismaMock.appointmentService.findMany.mock.calls[0][0]
    expect(svcArg.where.appointment.startTime).toBeUndefined()
    const prodArg = prismaMock.appointmentProduct.aggregate.mock.calls[0][0]
    expect(prodArg.where.payment.createdAt).toBeUndefined()
  })

  it("includes a Products bucket when product lines exist (no longer structurally $0)", async () => {
    prismaMock.appointmentService.findMany.mockResolvedValue([
      { finalPrice: 100, service: { category: { name: "Hair" } } },
    ])
    prismaMock.appointmentProduct.aggregate.mockResolvedValue({ _sum: { totalPrice: 75 } })

    const result = await getRevenueByCategory(BIZ)
    const products = result.find((r) => r.name === "Products")
    expect(products).toBeDefined()
    expect(products?.value).toBe(75)
  })
})

describe("getRevenueByPaymentMethod — honours the picker range", () => {
  it("windows the payment groupBy by createdAt when a range is supplied", async () => {
    prismaMock.payment.groupBy.mockResolvedValue([])
    const from = new Date("2026-06-01T00:00:00Z")
    const to = new Date("2026-06-30T00:00:00Z")

    await getRevenueByPaymentMethod(BIZ, { from, to })

    const arg = prismaMock.payment.groupBy.mock.calls[0][0]
    expect(arg.where.status).toBe("completed")
    expect(arg.where.createdAt).toBeDefined()
    expect(arg.where.createdAt.gte).toEqual(from)
  })

  it("stays all-time when no range is supplied", async () => {
    prismaMock.payment.groupBy.mockResolvedValue([])
    await getRevenueByPaymentMethod(BIZ)
    const arg = prismaMock.payment.groupBy.mock.calls[0][0]
    expect(arg.where.createdAt).toBeUndefined()
  })
})

describe("getStaffPerformance — revenue ties to the Commission ledger", () => {
  it("derives revenue from Commission.grossAmount on the SAME window/type as commission", async () => {
    prismaMock.staff.findMany.mockResolvedValue([
      { id: STAFF, commissionRate: 30, user: { firstName: "Jamie", lastName: "Lee" } },
    ])
    // Appointment count (visits) is separate.
    prismaMock.appointmentService.groupBy.mockResolvedValue([{ staffId: STAFF, _count: 6 }])
    prismaMock.review.groupBy.mockResolvedValue([{ staffId: STAFF, _avg: { overallRating: 4.8 } }])
    // Ledger: gross $1000 earned, commission $300 — revenue must read from gross.
    prismaMock.commission.groupBy.mockResolvedValue([
      { staffId: STAFF, _sum: { grossAmount: 1000, commissionAmount: 300 } },
    ])

    const result = await getStaffPerformance(BIZ, {
      from: new Date("2026-06-01T00:00:00Z"),
      to: new Date("2026-06-30T00:00:00Z"),
    })

    expect(result).toEqual([
      { name: "Jamie Lee", appointments: 6, revenue: 1000, rating: 4.8, commission: 300 },
    ])
    // commission is ~30% of revenue — they reconcile because both come from the
    // same ledger rows.
    expect(result[0].commission / result[0].revenue).toBeCloseTo(0.3, 5)

    // Ledger query is scoped to type:"service" over the createdAt window.
    const cArg = prismaMock.commission.groupBy.mock.calls[0][0]
    expect(cArg.where.type).toBe("service")
    expect(cArg.where.createdAt).toBeDefined()
    expect(cArg._sum).toEqual({ grossAmount: true, commissionAmount: true })
  })

  it("honestly reports $0 revenue and commission when the ledger is empty", async () => {
    prismaMock.staff.findMany.mockResolvedValue([
      { id: STAFF, commissionRate: 30, user: { firstName: "Sam", lastName: "Park" } },
    ])
    prismaMock.appointmentService.groupBy.mockResolvedValue([{ staffId: STAFF, _count: 2 }])
    prismaMock.review.groupBy.mockResolvedValue([])
    prismaMock.commission.groupBy.mockResolvedValue([]) // empty ledger

    const result = await getStaffPerformance(BIZ, {
      from: new Date("2026-06-01T00:00:00Z"),
      to: new Date("2026-06-30T00:00:00Z"),
    })

    expect(result[0].revenue).toBe(0)
    expect(result[0].commission).toBe(0)
    // Appointment-count metric still reflects the visit count.
    expect(result[0].appointments).toBe(2)
  })
})
