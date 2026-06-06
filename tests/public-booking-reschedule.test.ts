import { describe, it, expect, beforeEach, vi } from "vitest"
import { ERR_OUTSIDE_WORKING_HOURS } from "@/lib/scheduling/working-hours"

// Backs the "Client self-service reschedule from the manage link" workstream.
// reschedulePublicBooking lets a client move their own appointment from the
// public /book/manage/[ref] page. It must NOT become a hole in the booking
// safety net, so these tests prove — over a mock Prisma (no DB) and the REAL
// assertSlotAllowed working-hours guard fed a fake tx — that:
//
//   - a wrong email is rejected (identity guard, mirrors cancelPublicBooking)
//   - an out-of-hours slot is rejected (real assertSlotAllowed fires inside the
//     advisory-locked transaction; the appointment is never updated)
//   - a valid in-hours move succeeds: the appointment + each service row are
//     shifted by the same delta and the action returns the new window
//
// Tenant isolation: the action derives businessId/locationId ONLY from the
// persisted appointment row, never from caller input — there is no businessId
// parameter to spoof.

const { prismaMock, getSettingsMock, rateLimitMock, sendEmailMock, lockMock, revalidateMock } =
  vi.hoisted(() => {
    return {
      prismaMock: {
        appointment: { findUnique: vi.fn() },
        $transaction: vi.fn(),
      },
      getSettingsMock: vi.fn(),
      rateLimitMock: vi.fn(),
      sendEmailMock: vi.fn(),
      lockMock: vi.fn(),
      revalidateMock: vi.fn(),
    }
  })

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/actions/booking-settings", () => ({
  getPublicBookingSettings: getSettingsMock,
}))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("@/lib/db/advisory-lock", () => ({ lockStaffSchedule: lockMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }))
// NOTE: @/lib/scheduling/working-hours is NOT mocked — we run the real
// assertSlotAllowed against a fake tx so the out-of-hours rejection is genuine.

import { reschedulePublicBooking } from "@/lib/actions/public-booking"

const REF = "ABC123"
const EMAIL = "client@example.com"
const STAFF = "staff_1"
const LOC = "loc_1"
const BIZ = "biz_1"

// @db.Time values: Dates whose time-of-day is what matters. 9am–5pm schedule.
const t = (h: number, m = 0) => new Date(2000, 0, 1, h, m, 0, 0)
const open9to5 = { startTime: t(9), endTime: t(17), breaks: [] as unknown[] }

// A future Wednesday well outside any lead/cancellation window.
function futureWednesdayAt(h: number, m = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  // advance to the next Wednesday (getDay() === 3)
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1)
  d.setHours(h, m, 0, 0)
  return d
}

const originalStart = futureWednesdayAt(10) // 10:00
const originalEnd = futureWednesdayAt(11) // 11:00 (60 min)

function baseAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "appt_1",
    bookingReference: REF,
    businessId: BIZ,
    locationId: LOC,
    status: "confirmed",
    startTime: originalStart,
    endTime: originalEnd,
    totalDuration: 60,
    client: { email: EMAIL, firstName: "Jane", lastName: "Doe" },
    business: { name: "Anas Barbershop" },
    services: [
      {
        id: "as_1",
        staffId: STAFF,
        startTime: originalStart,
        endTime: originalEnd,
        service: { name: "Haircut" },
        staff: { user: { firstName: "Sam", lastName: "Cutter" } },
      },
    ],
    ...overrides,
  }
}

// Fake transaction client: provides what the REAL assertSlotAllowed reads
// (staffSchedule + staffTimeOff) plus the write/conflict surface the action
// uses. `schedule` controls whether the slot is in working hours.
function makeTx(opts: {
  schedule?: typeof open9to5 | null
  conflict?: boolean
  canAcceptBookings?: boolean
}) {
  const apptUpdate = vi.fn(async (_args: { where: unknown; data: { startTime: Date; endTime: Date } }) => ({}))
  const svcUpdate = vi.fn(async (_args: { where: { id: string }; data: { startTime: Date; endTime: Date } }) => ({}))
  const tx = {
    staffSchedule: { findFirst: async () => opts.schedule ?? null },
    staffTimeOff: { findFirst: async () => null },
    // The reschedule write path re-checks the online-booking gate per staff.
    staff: {
      findUnique: vi.fn(async () => ({ canAcceptBookings: opts.canAcceptBookings ?? true })),
    },
    appointmentService: {
      findFirst: vi.fn(async () => (opts.conflict ? { id: "conflict" } : null)),
      update: svcUpdate,
    },
    appointment: { update: apptUpdate },
  }
  return { tx, apptUpdate, svcUpdate }
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.mockReturnValue({ limited: false })
  getSettingsMock.mockResolvedValue({
    minLeadTime: "none",
    maxAdvanceBooking: "3m",
    cancellationWindow: "none",
    autoConfirm: true,
  })
  sendEmailMock.mockResolvedValue({ success: true })
  lockMock.mockResolvedValue(undefined)
})

describe("reschedulePublicBooking — identity guard", () => {
  it("rejects a wrong email and never touches the appointment", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(baseAppointment())

    const newStart = futureWednesdayAt(13).toISOString()
    const result = await reschedulePublicBooking(REF, "attacker@evil.com", newStart)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/email does not match/i)
    }
    // No transaction ever runs for a failed identity check.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe("reschedulePublicBooking — working-hours guard", () => {
  it("rejects an out-of-hours slot via the real assertSlotAllowed", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(baseAppointment())

    // The staff member works 9–5; move to 18:00 (6pm) — outside hours.
    // Run the action's transaction callback against our fake tx so the real
    // assertSlotAllowed actually executes and throws.
    const { tx, apptUpdate } = makeTx({ schedule: open9to5 })
    prismaMock.$transaction.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) =>
      cb(tx),
    )

    const newStart = futureWednesdayAt(18).toISOString() // 6pm, after close
    const result = await reschedulePublicBooking(REF, EMAIL, newStart)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/outside the staff member's working hours/i)
    }
    // Appointment time must NOT be updated when the guard rejects.
    expect(apptUpdate).not.toHaveBeenCalled()
  })

  it("surfaces the ERR_OUTSIDE_WORKING_HOURS sentinel as a friendly error", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(baseAppointment())
    const { tx } = makeTx({ schedule: null }) // no schedule that day at all
    prismaMock.$transaction.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) =>
      cb(tx),
    )

    const newStart = futureWednesdayAt(13).toISOString()
    const result = await reschedulePublicBooking(REF, EMAIL, newStart)

    expect(result.success).toBe(false)
    // Sanity: the sentinel exists and the action translated it (not leaked raw).
    expect(ERR_OUTSIDE_WORKING_HOURS).toBe("OUTSIDE_WORKING_HOURS")
    if (!result.success) {
      expect(result.error).not.toBe(ERR_OUTSIDE_WORKING_HOURS)
    }
  })
})

describe("reschedulePublicBooking — canAcceptBookings gate", () => {
  it("rejects when the staff member no longer accepts online bookings", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(baseAppointment())

    // In-hours slot, no conflict, but the staff was switched to not-accepting.
    const { tx, apptUpdate, svcUpdate } = makeTx({
      schedule: open9to5,
      conflict: false,
      canAcceptBookings: false,
    })
    prismaMock.$transaction.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) =>
      cb(tx),
    )

    const newStart = futureWednesdayAt(13).toISOString()
    const result = await reschedulePublicBooking(REF, EMAIL, newStart)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/no longer accepting online bookings/i)
    }
    // The gate fires before any write — nothing is moved.
    expect(apptUpdate).not.toHaveBeenCalled()
    expect(svcUpdate).not.toHaveBeenCalled()
    // The flag was actually re-checked for the booking's staff member.
    expect(tx.staff.findUnique).toHaveBeenCalledWith({
      where: { id: STAFF },
      select: { canAcceptBookings: true },
    })
  })
})

describe("reschedulePublicBooking — valid in-hours move", () => {
  it("shifts the appointment + service rows by the delta and returns the new window", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(baseAppointment())

    const { tx, apptUpdate, svcUpdate } = makeTx({ schedule: open9to5, conflict: false })
    prismaMock.$transaction.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) =>
      cb(tx),
    )

    // Move from 10:00 to 13:00 — still inside 9–5.
    const newStart = futureWednesdayAt(13)
    const result = await reschedulePublicBooking(REF, EMAIL, newStart.toISOString())

    expect(result.success).toBe(true)
    if (result.success) {
      // New start echoed back; end is start + 60 min (recomputed from totalDuration).
      expect(new Date(result.data.startTime).getTime()).toBe(newStart.getTime())
      expect(
        new Date(result.data.endTime).getTime() - new Date(result.data.startTime).getTime(),
      ).toBe(60 * 60 * 1000)
    }

    // Appointment row updated with the new start/end.
    expect(apptUpdate).toHaveBeenCalledTimes(1)
    const apptArg = apptUpdate.mock.calls[0][0] as { where: unknown; data: { startTime: Date } }
    expect(apptArg.where).toEqual({ id: "appt_1" })
    expect((apptArg.data.startTime as Date).getTime()).toBe(newStart.getTime())

    // The single service row shifted by the same +3h delta.
    expect(svcUpdate).toHaveBeenCalledTimes(1)
    const svcArg = svcUpdate.mock.calls[0][0] as {
      where: { id: string }
      data: { startTime: Date; endTime: Date }
    }
    expect(svcArg.where.id).toBe("as_1")
    expect((svcArg.data.startTime as Date).getTime()).toBe(newStart.getTime())

    // The staff schedule was advisory-locked before the write (race safety).
    expect(lockMock).toHaveBeenCalledWith(expect.anything(), BIZ, STAFF)
    // Best-effort reschedule email attempted.
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it("rejects when the slot collides with another booking (conflict check)", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(baseAppointment())

    const { tx, apptUpdate } = makeTx({ schedule: open9to5, conflict: true })
    prismaMock.$transaction.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) =>
      cb(tx),
    )

    const newStart = futureWednesdayAt(13).toISOString()
    const result = await reschedulePublicBooking(REF, EMAIL, newStart)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/already booked/i)
    }
    expect(apptUpdate).not.toHaveBeenCalled()
  })
})
