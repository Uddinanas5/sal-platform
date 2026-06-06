import { describe, it, expect, beforeEach, vi } from "vitest"

// Guards Finding 4: dashboard weekly + monthly revenue must come from the Payment
// ledger (status:"completed", createdAt window) — the SAME source as today's
// revenue and the 7-day sparkline — NOT from Appointment.totalAmount (the booked
// estimate written at booking and never updated at checkout). Mock Prisma — no DB.

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    appointment: { findMany: vi.fn(), aggregate: vi.fn() },
    payment: { aggregate: vi.fn() },
    client: { count: vi.fn() },
    review: { aggregate: vi.fn() },
  }
  return { prismaMock }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { getDashboardStats } from "@/lib/queries/appointments"

const BIZ = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getDashboardStats — weekly/monthly revenue from the Payment ledger", () => {
  it("sources today, weekly, and monthly revenue all from payment.aggregate (not appointment.aggregate)", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      { status: "completed" },
      { status: "confirmed" },
    ])
    prismaMock.client.count.mockResolvedValue(0)
    prismaMock.review.aggregate.mockResolvedValue({ _avg: { overallRating: 0 }, _count: 0 })

    // Three payment.aggregate calls in order: today, weekly, monthly.
    prismaMock.payment.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 120 } }) // today
      .mockResolvedValueOnce({ _sum: { totalAmount: 800 } }) // weekly
      .mockResolvedValueOnce({ _sum: { totalAmount: 3000 } }) // monthly

    const stats = await getDashboardStats(BIZ)

    expect(stats.todayRevenue).toBe(120)
    expect(stats.weeklyRevenue).toBe(800)
    expect(stats.monthlyRevenue).toBe(3000)

    // Weekly + monthly must NOT come from the appointment estimate ledger.
    expect(prismaMock.appointment.aggregate).not.toHaveBeenCalled()
    // Three payment aggregates: today + weekly + monthly.
    expect(prismaMock.payment.aggregate).toHaveBeenCalledTimes(3)

    // Weekly + monthly payment aggregates are scoped to completed payments by createdAt.
    const weeklyArg = prismaMock.payment.aggregate.mock.calls[1][0]
    const monthlyArg = prismaMock.payment.aggregate.mock.calls[2][0]
    expect(weeklyArg.where.status).toBe("completed")
    expect(weeklyArg.where.createdAt).toBeDefined()
    expect(monthlyArg.where.status).toBe("completed")
    expect(monthlyArg.where.createdAt).toBeDefined()
  })
})
