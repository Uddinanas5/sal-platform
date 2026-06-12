import { describe, it, expect, beforeEach, vi } from "vitest"

// NEGATIVE TEST — public self-service "manage booking" authorization.
//
// FINDING (documented): the public manage/cancel/reschedule path does NOT use
// an HMAC/signed token like the review-collection links (/r/[token] →
// reviews/review-token.ts createReviewToken/verifyReviewToken). Instead the
// self-service link is /book/manage/[bookingReference], and the server actions
// cancelPublicBooking / reschedulePublicBooking (src/lib/actions/public-booking
// .ts) authorize a caller with TWO checks against the persisted row:
//
//   1. prisma.appointment.findUnique({ where: { bookingReference } }) — an
//      unknown / forged / tampered reference resolves to null ("Booking not
//      found"), so there is nothing to mutate. The reference itself is the
//      capability (64 bits, randomBytes(8) in booking-reference.ts), so a
//      tampered/guessed value behaves exactly like an unknown one.
//   2. An identity guard: appointment.client.email must (case-insensitively)
//      match the supplied clientEmail, else "Email does not match the booking".
//      This is the second authorization gate — possessing a real reference is
//      not enough; you must also prove the booking's email.
//
// Per the task: since the manage flow is a plain bookingReference (not a signed
// token), we assert the CORRECT alternative behavior — cancel/reschedule for a
// NON-MATCHING/UNKNOWN reference, AND for a real reference with a NON-MATCHING
// email, are REJECTED WITH NO WRITE (no appointment.update). This mirrors the
// tampering assertion of tests/review-token.test.ts (forged credential → reject,
// no effect) but on the real manage code path.
//
// These tests FAIL-WITHOUT / PASS-WITH the real guards: deleting the findUnique
// null-check would let an unknown ref proceed to update; deleting the email
// guard would let any caller cancel/reschedule any known booking. Either makes
// the "update never called" assertions fail.

// ---------------------------------------------------------------------------
// Hoisted mock-Prisma (vi.mock factories are hoisted above imports). We mock
// ONLY the modules public-booking.ts imports that touch I/O: prisma, the rate
// limiter, email, next/cache, and getPublicBookingSettings. The advisory-lock
// raw SQL is neutralized but $transaction stays real-shaped via prismaMock.
// ---------------------------------------------------------------------------
const { prismaMock, rateLimitMock, getPublicBookingSettingsMock, sendEmailMock } =
  vi.hoisted(() => {
    const prismaMock = {
      appointment: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      appointmentService: { findFirst: vi.fn(), update: vi.fn() },
      staff: { findUnique: vi.fn() },
      // $transaction must NEVER run for a rejected caller; if a regression let a
      // forged/mismatched call through, this would be invoked and the test's
      // "no write" assertions (update + $transaction not called) would fail.
      $transaction: vi.fn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (cb: (tx: unknown) => unknown, ..._rest: any[]) =>
          cb({
            appointment: { update: vi.fn() },
            appointmentService: { findFirst: vi.fn(), update: vi.fn() },
            staff: { findUnique: vi.fn() },
          }),
      ),
    }
    return {
      prismaMock,
      rateLimitMock: vi.fn(),
      getPublicBookingSettingsMock: vi.fn(),
      sendEmailMock: vi.fn(),
    }
  })

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("@/lib/actions/booking-settings", () => ({
  getPublicBookingSettings: getPublicBookingSettingsMock,
}))
// Neutralize the advisory-lock raw SQL (no DB); these only run AFTER the guards
// we are testing, so for the negative cases they must never be reached.
vi.mock("@/lib/db/advisory-lock", () => ({
  lockStaffSchedule: vi.fn(),
  isBookingContentionError: vi.fn(() => false),
}))

import {
  cancelPublicBooking,
  reschedulePublicBooking,
} from "@/lib/actions/public-booking"

// Valid v4 UUIDs (version "4" nibble + variant "8/9/a/b").
const APPT = "11111111-1111-4111-8111-111111111111"
const BIZ = "22222222-2222-4222-8222-222222222222"
const LOCATION = "33333333-3333-4333-8333-333333333333"
const STAFF = "44444444-4444-4444-8444-444444444444"
const SVC = "55555555-5555-4555-8555-555555555555"

// A genuine reference produced by the real generator's shape.
const REAL_REF = "SAL-A1B2C3D4E5F60718"
// A tampered/forged reference — never persisted, so findUnique can't match it.
const FORGED_REF = "SAL-DEADBEEFDEADBEEF"

const OWNER_EMAIL = "owner@example.com"
const ATTACKER_EMAIL = "attacker@example.com"

// Far-future appointment so the cancellation-window gate (if ever reached) is
// open — isolates the test on the AUTHORIZATION guards, not timing.
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

// A fully-populated appointment row the way findUnique returns it (with the
// nested includes cancel/reschedule request). Used ONLY for the wrong-email
// cases where a row genuinely exists.
function ownedAppointment() {
  return {
    id: APPT,
    businessId: BIZ,
    locationId: LOCATION,
    bookingReference: REAL_REF,
    status: "confirmed",
    startTime: FUTURE,
    endTime: new Date(FUTURE.getTime() + 30 * 60 * 1000),
    totalDuration: 30,
    client: { email: OWNER_EMAIL, firstName: "Owner", lastName: "Person" },
    business: { name: "Test Salon", email: "salon@example.com", settings: {}, timezone: "America/New_York" },
    services: [
      {
        id: "svc-row-1",
        staffId: STAFF,
        serviceId: SVC,
        startTime: FUTURE,
        endTime: new Date(FUTURE.getTime() + 30 * 60 * 1000),
        service: { name: "Haircut" },
        staff: { user: { firstName: "Barb", lastName: "Er" } },
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Never rate-limited, so we always reach the authorization guards under test.
  rateLimitMock.mockResolvedValue({ limited: false, remaining: 5 })
  // "none" window → cancellation/reschedule is allowed up to the appointment
  // start; keeps the negative tests focused on identity, not the time gate.
  getPublicBookingSettingsMock.mockResolvedValue({
    minLeadTime: "none",
    maxAdvanceBooking: "3m",
    cancellationWindow: "none",
  })
  sendEmailMock.mockResolvedValue(undefined)
})

// ===========================================================================
// cancelPublicBooking — forged / unknown reference and wrong email are rejected
// ===========================================================================
describe("cancelPublicBooking — self-service authorization (no signed token)", () => {
  it("rejects a forged/unknown bookingReference (findUnique→null) with NO write", async () => {
    // The forged reference was never persisted: findUnique resolves to null.
    prismaMock.appointment.findUnique.mockResolvedValue(null)

    const res = await cancelPublicBooking(FORGED_REF, OWNER_EMAIL)

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/not found/i)
    // The lookup keyed on the forged reference verbatim — never trusted as valid.
    const where = prismaMock.appointment.findUnique.mock.calls[0][0].where as { bookingReference: string }
    expect(where.bookingReference).toBe(FORGED_REF)
    // Nothing was mutated: no status flip to "cancelled".
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it("rejects a real reference presented with the WRONG email (identity guard) with NO write", async () => {
    // The reference is genuine and resolves to the owner's booking, but the
    // caller supplies a different email — the second authorization gate.
    prismaMock.appointment.findUnique.mockResolvedValue(ownedAppointment())

    const res = await cancelPublicBooking(REAL_REF, ATTACKER_EMAIL)

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/email does not match/i)
    // Even though the row exists, the mismatch blocks the cancel write entirely.
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it("CONTROL: the matching reference + matching email DOES cancel (proves the guards aren't blanket-deny)", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(ownedAppointment())
    prismaMock.appointment.update.mockResolvedValue({ id: APPT, status: "cancelled" })

    const res = await cancelPublicBooking(REAL_REF, OWNER_EMAIL)

    expect(res.success).toBe(true)
    if (res.success) expect(res.data.status).toBe("cancelled")
    // The legitimate owner's cancel flips status to "cancelled".
    expect(prismaMock.appointment.update).toHaveBeenCalledTimes(1)
    const data = prismaMock.appointment.update.mock.calls[0][0].data as { status: string }
    expect(data.status).toBe("cancelled")
  })
})

// ===========================================================================
// reschedulePublicBooking — same two gates, plus the transaction must not run
// ===========================================================================
describe("reschedulePublicBooking — self-service authorization (no signed token)", () => {
  const NEW_START = new Date(FUTURE.getTime() + 60 * 60 * 1000).toISOString()

  it("rejects a forged/unknown bookingReference (findUnique→null) with NO write and NO transaction", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(null)

    const res = await reschedulePublicBooking(FORGED_REF, OWNER_EMAIL, NEW_START)

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/not found/i)
    const where = prismaMock.appointment.findUnique.mock.calls[0][0].where as { bookingReference: string }
    expect(where.bookingReference).toBe(FORGED_REF)
    // The slot-mutation transaction is never entered for an unknown booking.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it("rejects a real reference presented with the WRONG email (identity guard) with NO write and NO transaction", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(ownedAppointment())

    const res = await reschedulePublicBooking(REAL_REF, ATTACKER_EMAIL, NEW_START)

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/email does not match/i)
    // The mismatch short-circuits before any locking/conflict-check/update.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })
})
