import { describe, it, expect, vi, beforeEach } from "vitest"

// Guards GAP-001 on the INTERNAL/POS booking path: createAppointment must run
// the SAME assertSlotAllowed working-hours guard the public path uses, so staff
// cannot book a client onto a barber's day off, lunch break, or after close.
//
// We mock the action's collaborators (auth, ownership, advisory lock, email)
// and a fake prisma whose $transaction runs the callback with a tx exposing the
// two reads assertSlotAllowed performs (staffSchedule + staffTimeOff). The
// guard itself is the REAL implementation — only the data it reads is faked.

const BIZ = "11111111-1111-4111-8111-111111111111"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const STAFF = "55555555-5555-4555-8555-555555555555"
const SERVICE = "66666666-6666-4666-8666-666666666666"
const LOCATION = "77777777-7777-4777-8777-777777777777"

// @db.Time values: Dates whose time-of-day matters (combineDateWithTime reads
// getHours/getMinutes). Pin to an arbitrary date.
// @db.Time stored + read as UTC wall-clock by Prisma (adapter uses getUTCHours),
// so build with Date.UTC — host-TZ independent. The booking write path calls
// assertSlotAllowed with the default "UTC" timezone, so the slot instant below
// is UTC-anchored to match.
const t = (h: number, m = 0) => new Date(Date.UTC(2000, 0, 1, h, m, 0, 0))

// Tunable schedule/time-off the fake tx will return for assertSlotAllowed.
let scheduleReturn: { startTime: Date; endTime: Date; breaks: { startTime: Date; endTime: Date }[] } | null
let timeOffReturn: { startTime: Date | null; endTime: Date | null } | null
// Spy so we can assert the appointment is NOT written when the guard rejects.
const appointmentCreate = vi.fn(async () => ({ id: "appt_1", bookingReference: "BK-1" }))

function makeTx() {
  return {
    staffSchedule: { findFirst: vi.fn(async () => scheduleReturn) },
    staffTimeOff: { findFirst: vi.fn(async () => timeOffReturn) },
    appointmentService: {
      findFirst: vi.fn(async () => null), // no conflicting booking
      create: vi.fn(async () => ({ id: "as_1" })),
    },
    appointment: { create: appointmentCreate },
  }
}

vi.mock("@/lib/auth-utils", () => ({
  getBusinessContext: vi.fn(async () => ({ businessId: BIZ, userId: "user_1" })),
}))

vi.mock("@/lib/ownership", () => ({
  assertClientOwned: vi.fn(async () => undefined),
  assertStaffOwned: vi.fn(async () => undefined),
  generateBookingReference: vi.fn(() => "BK-1"),
}))

vi.mock("@/lib/db/advisory-lock", () => ({
  lockStaffSchedule: vi.fn(async () => undefined),
}))

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => undefined) }))
vi.mock("@/lib/email-templates", () => ({
  bookingConfirmationEmail: vi.fn(() => ""),
  appointmentCancelledEmail: vi.fn(() => ""),
  appointmentRescheduledEmail: vi.fn(() => ""),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: {
      // createAppointment now loads services with findMany for multi-service
      // support; return the requested haircut so the ordered lookup resolves.
      findMany: vi.fn(async () => [
        {
          id: SERVICE,
          name: "Haircut",
          durationMinutes: 45,
          price: 40,
          isTaxable: false,
          taxRate: null,
        },
      ]),
      findFirst: vi.fn(async () => ({
        id: SERVICE,
        name: "Haircut",
        durationMinutes: 45,
        price: 40,
        isTaxable: false,
        taxRate: null,
      })),
    },
    business: { findUnique: vi.fn(async () => ({ id: BIZ, name: "Shop", email: null, phone: null })) },
    location: { findFirst: vi.fn(async () => ({ id: LOCATION })) },
    client: { findUnique: vi.fn(async () => ({ id: CLIENT, firstName: "A", lastName: "B", email: null })) },
    staff: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(async (cb: (tx: ReturnType<typeof makeTx>) => unknown) => cb(makeTx())),
  },
}))

import { createAppointment } from "@/lib/actions/appointments"

const baseInput = {
  clientId: CLIENT,
  serviceId: SERVICE,
  staffId: STAFF,
  // Wednesday 2026-06-03, 10:00 UTC — well inside a 9-5 schedule (default tz).
  startTime: new Date(Date.UTC(2026, 5, 3, 10, 0, 0, 0)).toISOString(),
}

beforeEach(() => {
  vi.clearAllMocks()
  scheduleReturn = { startTime: t(9), endTime: t(17), breaks: [] }
  timeOffReturn = null
})

describe("createAppointment — internal working-hours guard (GAP-001)", () => {
  it("rejects an internal booking when the staff has no schedule that day (day off)", async () => {
    scheduleReturn = null // not working this weekday
    const result = await createAppointment(baseInput)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/working hours/i)
    }
    // The appointment must NOT be written when the guard rejects.
    expect(appointmentCreate).not.toHaveBeenCalled()
  })

  it("rejects an internal booking that lands on a staff break (lunch)", async () => {
    scheduleReturn = {
      startTime: t(9),
      endTime: t(17),
      breaks: [{ startTime: t(10), endTime: t(11) }], // 10:00 booking overlaps lunch
    }
    const result = await createAppointment(baseInput)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/working hours/i)
    expect(appointmentCreate).not.toHaveBeenCalled()
  })

  it("rejects an internal booking during approved time off", async () => {
    timeOffReturn = { startTime: t(10), endTime: t(12) } // PTO over the slot
    const result = await createAppointment(baseInput)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/time off/i)
    expect(appointmentCreate).not.toHaveBeenCalled()
  })

  it("allows an internal booking fully inside working hours (guard passes through)", async () => {
    const result = await createAppointment(baseInput)
    expect(result.success).toBe(true)
    expect(appointmentCreate).toHaveBeenCalledTimes(1)
  })
})
