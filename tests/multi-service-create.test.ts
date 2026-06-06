import { describe, it, expect, vi, beforeEach } from "vitest"

// Proves the MULTI-SERVICE create path: a cut + beard trim as ONE appointment.
//
//  - Two requested services => TWO AppointmentService rows written.
//  - The appointment slot is sized by the COMBINED duration (sum), and each
//    service row chains back-to-back in the requested order.
//  - Prices/durations are recomputed from the DB rows, never from input.
//  - The Phase 0 working-hours guard (assertSlotAllowed) is applied over the
//    COMBINED [start, end) range, so a combo that spills into a break or past
//    close is rejected and NOTHING is written.
//
// Collaborators (auth, ownership, advisory lock, email) are mocked; the
// working-hours guard is the REAL implementation fed by a fake tx.

const BIZ = "11111111-1111-4111-8111-111111111111"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const STAFF = "55555555-5555-4555-8555-555555555555"
const SERVICE_CUT = "66666666-6666-4666-8666-666666666666"
const SERVICE_BEARD = "99999999-9999-4999-8999-999999999999"
const LOCATION = "77777777-7777-4777-8777-777777777777"

// @db.Time helper: a Date whose time-of-day is what matters.
// @db.Time stored + read as UTC wall-clock by Prisma (adapter uses getUTCHours),
// so build with Date.UTC — host-TZ independent. The booking write path calls
// assertSlotAllowed with the default "UTC" timezone, so the slot instants below
// are UTC-anchored to match.
const t = (h: number, m = 0) => new Date(Date.UTC(2000, 0, 1, h, m, 0, 0))

let scheduleReturn: { startTime: Date; endTime: Date; breaks: { startTime: Date; endTime: Date }[] } | null
let timeOffReturn: { startTime: Date | null; endTime: Date | null } | null

// Capture every AppointmentService row written so we can assert count + slicing.
const appointmentServiceCreate = vi.fn(async (args: { data: unknown }) => ({ id: "as_x", ...args }))
const appointmentCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: "appt_1",
  bookingReference: "BK-1",
  ...args.data,
}))

function makeTx() {
  return {
    staffSchedule: { findFirst: vi.fn(async () => scheduleReturn) },
    staffTimeOff: { findFirst: vi.fn(async () => timeOffReturn) },
    appointmentService: {
      findFirst: vi.fn(async () => null), // no conflicting booking
      create: appointmentServiceCreate,
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

// DB service rows: cut = 45min/$40, beard = 20min/$25. Combined = 65min/$65.
const DB_SERVICES: Record<string, { id: string; name: string; durationMinutes: number; price: number; isTaxable: boolean; taxRate: number | null }> = {
  [SERVICE_CUT]: { id: SERVICE_CUT, name: "Haircut", durationMinutes: 45, price: 40, isTaxable: false, taxRate: null },
  [SERVICE_BEARD]: { id: SERVICE_BEARD, name: "Beard Trim", durationMinutes: 20, price: 25, isTaxable: false, taxRate: null },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: {
      // Multi-service create loads its services via findMany scoped by tenant.
      findMany: vi.fn(async (args: { where: { id: { in: string[] }; businessId: string } }) =>
        args.where.id.in
          .map((id) => DB_SERVICES[id])
          .filter((s) => s && args.where.businessId === BIZ),
      ),
    },
    business: { findUnique: vi.fn(async () => ({ id: BIZ, name: "Shop", email: null, phone: null })) },
    location: { findFirst: vi.fn(async () => ({ id: LOCATION })) },
    client: { findUnique: vi.fn(async () => ({ id: CLIENT, firstName: "A", lastName: "B", email: null })) },
    staff: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(async (cb: (tx: ReturnType<typeof makeTx>) => unknown) => cb(makeTx())),
  },
}))

import { createAppointment } from "@/lib/actions/appointments"

// Wednesday 2026-06-03, 10:00 local — inside a 9-5 schedule.
const START = new Date(Date.UTC(2026, 5, 3, 10, 0, 0, 0))

beforeEach(() => {
  vi.clearAllMocks()
  scheduleReturn = { startTime: t(9), endTime: t(17), breaks: [] }
  timeOffReturn = null
})

describe("createAppointment — multi-service combo", () => {
  it("writes one AppointmentService row per service, chained back-to-back", async () => {
    const result = await createAppointment({
      clientId: CLIENT,
      serviceIds: [SERVICE_CUT, SERVICE_BEARD],
      staffId: STAFF,
      startTime: START.toISOString(),
    })

    expect(result.success).toBe(true)
    // TWO service rows for the two requested services.
    expect(appointmentServiceCreate).toHaveBeenCalledTimes(2)

    const rows = appointmentServiceCreate.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data)

    // Row 1 = cut (45min) starting at 10:00, ending 10:45.
    expect(rows[0].serviceId).toBe(SERVICE_CUT)
    expect(rows[0].durationMinutes).toBe(45)
    expect(rows[0].price).toBe(40)
    expect((rows[0].startTime as Date).getTime()).toBe(START.getTime())
    expect((rows[0].endTime as Date).getTime()).toBe(new Date(Date.UTC(2026, 5, 3, 10, 45)).getTime())

    // Row 2 = beard (20min) starting where the cut ended (10:45), ending 11:05.
    expect(rows[1].serviceId).toBe(SERVICE_BEARD)
    expect(rows[1].durationMinutes).toBe(20)
    expect(rows[1].price).toBe(25)
    expect((rows[1].startTime as Date).getTime()).toBe(new Date(Date.UTC(2026, 5, 3, 10, 45)).getTime())
    expect((rows[1].endTime as Date).getTime()).toBe(new Date(Date.UTC(2026, 5, 3, 11, 5)).getTime())
  })

  it("sizes the appointment by COMBINED duration and sums prices from the DB", async () => {
    await createAppointment({
      clientId: CLIENT,
      serviceIds: [SERVICE_CUT, SERVICE_BEARD],
      staffId: STAFF,
      startTime: START.toISOString(),
    })

    expect(appointmentCreate).toHaveBeenCalledTimes(1)
    const appt = (appointmentCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data

    // Combined duration 45 + 20 = 65 minutes.
    expect(appt.totalDuration).toBe(65)
    expect((appt.startTime as Date).getTime()).toBe(START.getTime())
    expect((appt.endTime as Date).getTime()).toBe(new Date(Date.UTC(2026, 5, 3, 11, 5)).getTime())

    // Money summed from DB prices (not input): 40 + 25, no tax on these rows.
    expect(appt.subtotal).toBe(65)
    expect(appt.taxAmount).toBe(0)
    expect(appt.totalAmount).toBe(65)
  })

  it("rejects the combo when the COMBINED range overruns a break, writing nothing", async () => {
    // Cut alone (10:00-10:45) clears a 10:50 break, but the combined 65-min
    // block ends 11:05 and overlaps a 10:50-11:30 lunch. The guard must reject.
    scheduleReturn = {
      startTime: t(9),
      endTime: t(17),
      breaks: [{ startTime: t(10, 50), endTime: t(11, 30) }],
    }

    const result = await createAppointment({
      clientId: CLIENT,
      serviceIds: [SERVICE_CUT, SERVICE_BEARD],
      staffId: STAFF,
      startTime: START.toISOString(),
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/working hours/i)
    expect(appointmentCreate).not.toHaveBeenCalled()
    expect(appointmentServiceCreate).not.toHaveBeenCalled()
  })

  it("rejects the combo when it runs past close, writing nothing", async () => {
    // Start at 16:30; combined 65 min ends 17:35, past a 17:00 close.
    scheduleReturn = { startTime: t(9), endTime: t(17), breaks: [] }
    const lateStart = new Date(Date.UTC(2026, 5, 3, 16, 30, 0, 0))

    const result = await createAppointment({
      clientId: CLIENT,
      serviceIds: [SERVICE_CUT, SERVICE_BEARD],
      staffId: STAFF,
      startTime: lateStart.toISOString(),
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/working hours/i)
    expect(appointmentCreate).not.toHaveBeenCalled()
    expect(appointmentServiceCreate).not.toHaveBeenCalled()
  })

  it("still supports the single-service back-compat shape", async () => {
    const result = await createAppointment({
      clientId: CLIENT,
      serviceId: SERVICE_CUT,
      staffId: STAFF,
      startTime: START.toISOString(),
    })

    expect(result.success).toBe(true)
    expect(appointmentServiceCreate).toHaveBeenCalledTimes(1)
    const appt = (appointmentCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(appt.totalDuration).toBe(45)
    expect(appt.subtotal).toBe(40)
  })

  it("rejects when a requested service belongs to another tenant (scoping)", async () => {
    // findMany is scoped by businessId; an id the tenant doesn't own simply
    // isn't returned, so the ordered lookup finds a hole and we fail fast.
    const FOREIGN = "12121212-1212-4121-8121-121212121212"
    const result = await createAppointment({
      clientId: CLIENT,
      serviceIds: [SERVICE_CUT, FOREIGN],
      staffId: STAFF,
      startTime: START.toISOString(),
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/service not found/i)
    expect(appointmentCreate).not.toHaveBeenCalled()
    expect(appointmentServiceCreate).not.toHaveBeenCalled()
  })
})
