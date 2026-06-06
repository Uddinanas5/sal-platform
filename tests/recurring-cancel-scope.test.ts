import { describe, it, expect, beforeEach, vi } from "vitest"

// Recurring cancel SCOPE resolution: "this" / "this & following" / "all" must
// translate into the right tenant-scoped Prisma WHERE, and a one-off (no series)
// must never batch-cancel. Also covers getSeriesInfo's badge/scope-gating
// signal. Pure unit tests over a fake Prisma — no DB, vi.hoisted pattern.

const { prismaMock, getBusinessContextMock } = vi.hoisted(() => {
  const prismaMock = {
    appointment: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  }
  return { prismaMock, getBusinessContextMock: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: getBusinessContextMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
// recurring.ts pulls these in for the create path; stub so the import resolves.
vi.mock("@/lib/db/advisory-lock", () => ({ lockStaffSchedule: vi.fn() }))
vi.mock("@/lib/ownership", () => ({
  assertClientOwned: vi.fn(),
  assertClientsOwned: vi.fn(),
  assertStaffOwned: vi.fn(),
  generateBookingReference: vi.fn(() => "BK-1"),
}))
vi.mock("@/lib/scheduling/working-hours", () => ({
  assertSlotAllowed: vi.fn(),
  ERR_OUTSIDE_WORKING_HOURS: "OUTSIDE_WORKING_HOURS",
  ERR_ON_APPROVED_TIME_OFF: "ON_APPROVED_TIME_OFF",
}))

import { cancelRecurring, getSeriesInfo } from "@/lib/actions/recurring"

// Valid v4 UUIDs (version "4" + variant "8/9/a/b" nibbles — Zod's .uuid()).
const BIZ = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const APPT = "33333333-3333-4333-8333-333333333333"
const SERIES = "44444444-4444-4444-8444-444444444444"
const START = new Date("2026-07-01T15:00:00.000Z")

const baseCancelInput = {
  appointmentId: APPT,
  status: "cancelled" as const,
  initiator: "business" as const,
  reasonCode: "client_request" as const,
  note: "stop the chair rental",
}

beforeEach(() => {
  vi.clearAllMocks()
  getBusinessContextMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
  prismaMock.appointment.update.mockResolvedValue({ id: APPT })
  prismaMock.appointment.updateMany.mockResolvedValue({ count: 5 })
})

describe("cancelRecurring — scope → WHERE resolution", () => {
  it('"this" updates ONLY this id, scoped by businessId, and never batches', async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: APPT, seriesId: SERIES, startTime: START })

    const res = await cancelRecurring({ ...baseCancelInput, scope: "this" })

    expect(res.success).toBe(true)
    if (res.success) expect(res.data.count).toBe(1)
    expect(prismaMock.appointment.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.appointment.update).toHaveBeenCalledTimes(1)

    const arg = prismaMock.appointment.update.mock.calls[0][0]
    expect(arg.where).toEqual({ id: APPT, businessId: BIZ })
    // Structured-reason fields mirror cancelAppointment.
    expect(arg.data.status).toBe("cancelled")
    expect(arg.data.cancellationInitiator).toBe("business")
    expect(arg.data.cancellationReasonCode).toBe("client_request")
    expect(arg.data.cancellationReason).toBe("stop the chair rental")
    expect(arg.data.cancelledBy).toBe(USER)
    expect(arg.data.cancelledAt).toBeInstanceOf(Date)
    expect(arg.data.noShowAt).toBeUndefined()
  })

  it('"following" batches the same series with startTime >= this occurrence', async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: APPT, seriesId: SERIES, startTime: START })

    const res = await cancelRecurring({ ...baseCancelInput, scope: "following" })

    expect(res.success).toBe(true)
    if (res.success) expect(res.data.count).toBe(5)
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
    expect(prismaMock.appointment.updateMany).toHaveBeenCalledTimes(1)

    const arg = prismaMock.appointment.updateMany.mock.calls[0][0]
    expect(arg.where.seriesId).toBe(SERIES)
    expect(arg.where.businessId).toBe(BIZ)
    expect(arg.where.startTime).toEqual({ gte: START })
    // Terminal occurrences are left alone.
    expect(arg.where.status).toEqual({ notIn: ["completed", "cancelled"] })
  })

  it('"all" batches the whole series with NO startTime filter', async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: APPT, seriesId: SERIES, startTime: START })

    const res = await cancelRecurring({ ...baseCancelInput, scope: "all" })

    expect(res.success).toBe(true)
    if (res.success) expect(res.data.count).toBe(5)
    const arg = prismaMock.appointment.updateMany.mock.calls[0][0]
    expect(arg.where.seriesId).toBe(SERIES)
    expect(arg.where.businessId).toBe(BIZ)
    expect(arg.where.startTime).toBeUndefined()
  })

  it("a one-off (no seriesId) asked to batch falls back to single-occurrence cancel", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: APPT, seriesId: null, startTime: START })

    const res = await cancelRecurring({ ...baseCancelInput, scope: "all" })

    expect(res.success).toBe(true)
    if (res.success) expect(res.data.count).toBe(1)
    expect(prismaMock.appointment.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.appointment.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.appointment.update.mock.calls[0][0].where).toEqual({ id: APPT, businessId: BIZ })
  })

  it("no-show writes noShowAt (not cancelledAt) and keeps the no_show status", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: APPT, seriesId: SERIES, startTime: START })

    const res = await cancelRecurring({
      ...baseCancelInput,
      scope: "this",
      status: "no_show",
      reasonCode: "no_show",
    })

    expect(res.success).toBe(true)
    const arg = prismaMock.appointment.update.mock.calls[0][0]
    expect(arg.data.status).toBe("no_show")
    expect(arg.data.noShowAt).toBeInstanceOf(Date)
    expect(arg.data.cancelledAt).toBeUndefined()
  })
})

describe("cancelRecurring — tenant scoping", () => {
  it("returns 'not found' when the anchor appointment is not in this business", async () => {
    // findFirst is tenant-scoped; a foreign appointment resolves to null.
    prismaMock.appointment.findFirst.mockImplementation(
      async (args: { where: { id: string; businessId: string } }) =>
        args.where.businessId === BIZ ? null : { id: APPT }
    )

    const res = await cancelRecurring({ ...baseCancelInput, scope: "all" })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("Appointment not found")
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
    expect(prismaMock.appointment.updateMany).not.toHaveBeenCalled()
  })

  it("every batch WHERE carries the caller's businessId", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: APPT, seriesId: SERIES, startTime: START })
    await cancelRecurring({ ...baseCancelInput, scope: "all" })
    expect(prismaMock.appointment.updateMany.mock.calls[0][0].where.businessId).toBe(BIZ)
  })

  it("rejects an invalid scope before touching the DB", async () => {
    const res = await cancelRecurring({
      ...baseCancelInput,
      // @ts-expect-error — deliberately invalid scope
      scope: "everything",
    })
    expect(res.success).toBe(false)
    expect(prismaMock.appointment.findFirst).not.toHaveBeenCalled()
  })
})

describe("getSeriesInfo — badge / scope gating signal", () => {
  it("reports isSeriesMember=true with the recurrence rule for a series member", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({
      seriesId: SERIES,
      recurrenceRule: "weekly",
      startTime: START,
    })

    const res = await getSeriesInfo(APPT)

    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.isSeriesMember).toBe(true)
      expect(res.data.recurrenceRule).toBe("weekly")
      expect(res.data.seriesId).toBe(SERIES)
    }
    // Lookup is tenant-scoped.
    expect(prismaMock.appointment.findFirst.mock.calls[0][0].where).toEqual({ id: APPT, businessId: BIZ })
  })

  it("reports isSeriesMember=false for a non-series appointment (no scope dialog)", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({
      seriesId: null,
      recurrenceRule: null,
      startTime: START,
    })

    const res = await getSeriesInfo(APPT)

    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.isSeriesMember).toBe(false)
      expect(res.data.recurrenceRule).toBeNull()
    }
  })

  it("returns 'not found' for an appointment outside the business", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    const res = await getSeriesInfo(APPT)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("Appointment not found")
  })
})
