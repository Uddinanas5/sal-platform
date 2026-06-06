import { describe, it, expect, vi, beforeEach } from "vitest"

// Closes the booking residual: the LIVE v1 REST API create route must run the
// SAME assertSlotAllowed working-hours guard the server actions use, so a
// crafted startTime via the API can't book a client onto a barber's lunch, day
// off, after close, or approved time-off (BOOKING-RESIDUAL).
//
// We mock the route's collaborators (auth, advisory lock, email) and a fake
// prisma whose $transaction runs the callback with a tx exposing the two reads
// assertSlotAllowed performs (staffSchedule + staffTimeOff). The guard itself is
// the REAL implementation — only the data it reads is faked. We assert the
// route returns a 400 and the appointment is NOT written.

const BIZ = "11111111-1111-4111-8111-111111111111"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const STAFF = "55555555-5555-4555-8555-555555555555"
const SERVICE = "66666666-6666-4666-8666-666666666666"
const LOCATION = "77777777-7777-4777-8777-777777777777"

// @db.Time values: Dates whose time-of-day matters (combineDateWithTime reads
// getHours/getMinutes). Pin to an arbitrary date.
// @db.Time values are stored + read as UTC wall-clock by Prisma (the adapter
// serializes with getUTCHours), so build with Date.UTC — host-TZ independent.
// The v1 route calls assertSlotAllowed with the default "UTC" timezone, so the
// slot instants below are UTC-anchored to match.
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

vi.mock("@/lib/api/auth", () => ({
  withV1Auth: vi.fn(async () => ({ userId: "user_1", businessId: BIZ, role: "admin" })),
}))

vi.mock("@/lib/db/advisory-lock", () => ({
  lockStaffSchedule: vi.fn(async () => undefined),
}))

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => undefined) }))
vi.mock("@/lib/email-templates", () => ({
  bookingConfirmationEmail: vi.fn(() => ""),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: {
      findFirst: vi.fn(async () => ({
        id: SERVICE,
        name: "Haircut",
        durationMinutes: 45,
        price: 40,
        isTaxable: false,
        taxRate: null,
      })),
    },
    client: { findFirst: vi.fn(async () => ({ id: CLIENT, firstName: "A", lastName: "B", email: null })) },
    staff: { findFirst: vi.fn(async () => ({ id: STAFF })) },
    business: { findUnique: vi.fn(async () => ({ id: BIZ, name: "Shop", email: null, phone: null })) },
    location: { findFirst: vi.fn(async () => ({ id: LOCATION })) },
    $transaction: vi.fn(async (cb: (tx: ReturnType<typeof makeTx>) => unknown) => cb(makeTx())),
  },
}))

import { POST } from "@/app/api/v1/appointments/route"

function makeReq(startTime: string): Request {
  return new Request("http://localhost/api/v1/appointments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: CLIENT, serviceId: SERVICE, staffId: STAFF, startTime }),
  })
}

// Wednesday 2026-06-03, 10:00 local — used as the base slot.
const inHours = new Date(Date.UTC(2026, 5, 3, 10, 0, 0, 0)).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  scheduleReturn = { startTime: t(9), endTime: t(17), breaks: [] }
  timeOffReturn = null
})

describe("POST /api/v1/appointments — v1 working-hours guard (BOOKING-RESIDUAL)", () => {
  it("rejects a v1 create when the staff has no schedule that day (day off)", async () => {
    scheduleReturn = null // not working this weekday
    const res = await POST(makeReq(inHours))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe("OUTSIDE_WORKING_HOURS")
    // The appointment must NOT be written when the guard rejects.
    expect(appointmentCreate).not.toHaveBeenCalled()
  })

  it("rejects a v1 create that lands after close (out of hours)", async () => {
    // 19:00 booking, schedule ends 17:00.
    const afterClose = new Date(Date.UTC(2026, 5, 3, 19, 0, 0, 0)).toISOString()
    const res = await POST(makeReq(afterClose))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe("OUTSIDE_WORKING_HOURS")
    expect(appointmentCreate).not.toHaveBeenCalled()
  })

  it("rejects a v1 create that lands on a staff break (lunch)", async () => {
    scheduleReturn = {
      startTime: t(9),
      endTime: t(17),
      breaks: [{ startTime: t(10), endTime: t(11) }], // 10:00 booking overlaps lunch
    }
    const res = await POST(makeReq(inHours))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe("OUTSIDE_WORKING_HOURS")
    expect(appointmentCreate).not.toHaveBeenCalled()
  })

  it("rejects a v1 create during approved time off", async () => {
    timeOffReturn = { startTime: t(10), endTime: t(12) } // PTO over the slot
    const res = await POST(makeReq(inHours))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe("ON_APPROVED_TIME_OFF")
    expect(appointmentCreate).not.toHaveBeenCalled()
  })

  it("allows a v1 create fully inside working hours (guard passes through)", async () => {
    const res = await POST(makeReq(inHours))
    expect(res.status).toBe(201)
    expect(appointmentCreate).toHaveBeenCalledTimes(1)
  })
})
