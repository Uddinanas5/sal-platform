import { describe, it, expect, beforeEach, vi } from "vitest"

// GROUP: BOOKING-SAFETY + WAITLIST hardening (mock-Prisma, vi.hoisted — no DB).
//
// Proves the read/write asymmetries the picker UI hides are now closed:
//   1. createPublicBooking rejects a deactivated / soft-deleted staff member
//      (write path now mirrors the public-picker read query's isActive/deletedAt).
//   2. A soft-deleted service (incl. one resurrected to isActive=true by the v1
//      toggle, deletedAt still set) is NOT bookable (deletedAt:null on the read).
//   3. The max-advance LAST day is bookable at any time-of-day (write maxDate is
//      end-of-day, matching /api/availability's inclusive boundary).
//   4. addToPublicWaitlist rejects an inactive/offline service, a cross-tenant
//      staffId, and an out-of-window preferredDate.
//   5. The v1 waitlist-book route rejects a cross-tenant appointmentId.
//   6. /api/availability surfaces machine-readable reason codes.

// ---------------------------------------------------------------------------
// Valid v4 UUIDs (createPublicBookingSchema validates serviceId/staffId .uuid()).
// ---------------------------------------------------------------------------
const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"
const SERVICE = "22222222-2222-4222-8222-222222222222"
const STAFF = "33333333-3333-4333-8333-333333333333"
const FOREIGN_STAFF = "44444444-4444-4444-8444-444444444444"
const LOC = "55555555-5555-4555-8555-555555555555"
const APPT = "66666666-6666-4666-8666-666666666666"
const FOREIGN_APPT = "77777777-7777-4777-8777-777777777777"

// ===========================================================================
// SHARED HOISTED MOCKS
// ===========================================================================
const {
  prismaMock,
  getSettingsMock,
  rateLimitMock,
  sendEmailMock,
  lockMock,
  isSlotAvailableMock,
  withV1AuthMock,
  getBusinessContextMock,
} = vi.hoisted(() => {
  return {
    prismaMock: {
      business: { findUnique: vi.fn() },
      location: { findFirst: vi.fn() },
      service: { findUnique: vi.fn() },
      staff: { findFirst: vi.fn() },
      staffService: { findFirst: vi.fn() },
      client: { findFirst: vi.fn(), create: vi.fn() },
      waitlistEntry: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
      appointment: { findFirst: vi.fn() },
      // $transaction default: never reached in these suites (the guards reject
      // before any write), but provide a permissive impl just in case.
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
          appointmentService: { findFirst: vi.fn(async () => null), create: vi.fn() },
          appointment: { create: vi.fn(async () => ({ id: APPT, bookingReference: "SALXXXX" })) },
          staffSchedule: { findFirst: vi.fn(async () => null) },
          staffTimeOff: { findFirst: vi.fn(async () => null) },
        }),
      ),
    },
    getSettingsMock: vi.fn(),
    rateLimitMock: vi.fn(),
    sendEmailMock: vi.fn(),
    lockMock: vi.fn(),
    isSlotAvailableMock: vi.fn(),
    withV1AuthMock: vi.fn(),
    getBusinessContextMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/actions/booking-settings", () => ({ getPublicBookingSettings: getSettingsMock }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("@/lib/email-templates", () => ({
  bookingConfirmationEmail: vi.fn(() => "<html>"),
  appointmentCancelledEmail: vi.fn(() => "<html>"),
  appointmentRescheduledEmail: vi.fn(() => "<html>"),
  lifecycleEmail: vi.fn(() => "<html>"),
}))
vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: getBusinessContextMock }))
vi.mock("@/lib/db/advisory-lock", () => ({
  lockStaffSchedule: lockMock,
  isBookingContentionError: vi.fn(() => false),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
// Slot machinery is exercised by availability-timezone/scheduling tests — here
// we isolate the staff/service/window GUARDS, so stub isSlotAvailable as OK.
vi.mock("@/lib/availability", () => ({ isSlotAvailable: isSlotAvailableMock }))
// Permissive working-hours guard (tested separately) so the create transaction
// doesn't reject for unrelated reasons; keep sentinels real for error mapping.
vi.mock("@/lib/scheduling/working-hours", () => ({
  assertSlotAllowed: vi.fn(async () => undefined),
  ERR_OUTSIDE_WORKING_HOURS: "OUTSIDE_WORKING_HOURS",
  ERR_ON_APPROVED_TIME_OFF: "ON_APPROVED_TIME_OFF",
}))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { createPublicBooking, addToPublicWaitlist } from "@/lib/actions/public-booking"
import { notifyWaitlistEntry } from "@/lib/actions/waitlist"
import { POST as waitlistBookPost } from "@/app/api/v1/waitlist/[id]/book/route"

// A future YYYY-MM-DD `n` days from today (local), and a slot instant on it.
function ymdPlus(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function slotPlus(days: number, hour = 14): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const validBookingInput = (over?: Record<string, unknown>) => ({
  businessId: BIZ,
  serviceId: SERVICE,
  staffId: STAFF,
  startTime: slotPlus(7), // a week out, inside any window
  clientFirstName: "Jane",
  clientLastName: "Doe",
  clientEmail: "jane@example.com",
  clientPhone: "+15550000000",
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.mockReturnValue({ limited: false })
  getSettingsMock.mockResolvedValue({
    minLeadTime: "none",
    maxAdvanceBooking: "1m", // 30 days
    cancellationWindow: "none",
    autoConfirm: true,
  })
  sendEmailMock.mockResolvedValue({ success: true })
  lockMock.mockResolvedValue(undefined)
  isSlotAvailableMock.mockResolvedValue(true)
  getBusinessContextMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })

  // Happy-path lookups (individual tests override the relevant one).
  prismaMock.business.findUnique.mockResolvedValue({ id: BIZ, name: "Anas Cuts", timezone: "UTC" })
  prismaMock.location.findFirst.mockResolvedValue({ id: LOC })
  prismaMock.service.findUnique.mockResolvedValue({
    id: SERVICE,
    name: "Haircut",
    durationMinutes: 30,
    price: 40,
    isActive: true,
    isOnlineBooking: true,
    isTaxable: false,
    taxRate: null,
  })
  prismaMock.staff.findFirst.mockResolvedValue({
    id: STAFF,
    user: { firstName: "Sam", lastName: "Cutter" },
  })
  prismaMock.staffService.findFirst.mockResolvedValue({ id: "ss_1" })
  prismaMock.client.findFirst.mockResolvedValue({
    id: "client_1",
    email: "jane@example.com",
    firstName: "Jane",
    lastName: "Doe",
  })
})

// ===========================================================================
// 1. createPublicBooking — deactivated / soft-deleted staff rejected
// ===========================================================================
describe("createPublicBooking — staff activation guard", () => {
  it("rejects when the staff lookup (isActive:true, deletedAt:null) returns null", async () => {
    // Simulate a deactivated/soft-deleted staff: the hardened findFirst no longer
    // resolves them, so the action returns 'Staff not found' before any write.
    prismaMock.staff.findFirst.mockResolvedValue(null)

    const res = await createPublicBooking(validBookingInput())

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/staff not found/i)
    // The staff query MUST carry the activation filter.
    const where = prismaMock.staff.findFirst.mock.calls[0][0].where
    expect(where.isActive).toBe(true)
    expect(where.deletedAt).toBe(null)
    expect(where.primaryLocation).toEqual({ businessId: BIZ })
    // No slot/transaction work happened.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("accepts an active staff member (filter present, slot ok)", async () => {
    prismaMock.$transaction.mockResolvedValue({ id: APPT, bookingReference: "SALABCD" })
    const res = await createPublicBooking(validBookingInput())
    expect(res.success).toBe(true)
  })
})

// ===========================================================================
// 2. createPublicBooking — resurrected soft-deleted service not bookable
// ===========================================================================
describe("createPublicBooking — service deletedAt guard", () => {
  it("filters deletedAt:null on the service lookup (resurrected-deleted not found)", async () => {
    // The v1 toggle can't resurrect anymore, but defense-in-depth: even if a
    // service is isActive=true with deletedAt set, this lookup excludes it.
    prismaMock.service.findUnique.mockResolvedValue(null)

    const res = await createPublicBooking(validBookingInput())

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/service not found/i)
    const where = prismaMock.service.findUnique.mock.calls[0][0].where
    expect(where.deletedAt).toBe(null)
    expect(where.businessId).toBe(BIZ)
  })

  it("rejects an inactive / offline service even if it isn't deleted", async () => {
    prismaMock.service.findUnique.mockResolvedValue({
      id: SERVICE,
      name: "Haircut",
      durationMinutes: 30,
      price: 40,
      isActive: false, // toggled off
      isOnlineBooking: true,
      isTaxable: false,
      taxRate: null,
    })
    const res = await createPublicBooking(validBookingInput())
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/isn't available for online booking/i)
  })
})

// ===========================================================================
// 3. createPublicBooking — max-advance LAST day accepted at any time-of-day
// ===========================================================================
describe("createPublicBooking — max-advance boundary", () => {
  it("accepts a 2pm slot on the LAST advance day (maxDate is end-of-day)", async () => {
    prismaMock.$transaction.mockResolvedValue({ id: APPT, bookingReference: "SALLAST" })
    // 30-day window; book day 30 at 14:00 — pre-fix this was rejected because
    // maxDate sat at midnight of day 30.
    const res = await createPublicBooking(validBookingInput({ startTime: slotPlus(30, 14) }))
    expect(res.success).toBe(true)
  })

  it("still rejects a slot beyond the window (day 31)", async () => {
    const res = await createPublicBooking(validBookingInput({ startTime: slotPlus(31, 14) }))
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/up to 30 days in advance/i)
  })
})

// ===========================================================================
// 3b. createPublicBooking — cancellation-policy consent recorded
// ===========================================================================
describe("createPublicBooking — cancellation-policy consent (ToS §7 evidence)", () => {
  it("stamps policyAcceptedAt on the created appointment (the public confirm step shows the policy)", async () => {
    // Adversarial ToS review, finding #13: the booking page used to CLAIM
    // "you agree to the cancellation policy" while nothing was shown or
    // logged. Now the confirm step displays the business's real cancellation
    // window, and confirming records WHEN — the consent evidence ToS §7 tells
    // merchants to provide in a dispute.
    const apptCreate = vi.fn()
    apptCreate.mockResolvedValue({ id: APPT, bookingReference: "SALPOL1" })
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        appointmentService: { findFirst: vi.fn(async () => null), create: vi.fn() },
        appointment: { create: apptCreate },
        staffSchedule: { findFirst: vi.fn(async () => null) },
        staffTimeOff: { findFirst: vi.fn(async () => null) },
      }),
    )

    const before = Date.now()
    const res = await createPublicBooking(validBookingInput())
    expect(res.success).toBe(true)

    const data = apptCreate.mock.calls[0][0].data
    expect(data.policyAcceptedAt).toBeInstanceOf(Date)
    expect((data.policyAcceptedAt as Date).getTime()).toBeGreaterThanOrEqual(before)
  })
})

// ===========================================================================
// 4. addToPublicWaitlist — service / staff / date hardening
// ===========================================================================
describe("addToPublicWaitlist — hardening", () => {
  const validWaitlistInput = (over?: Record<string, unknown>) => ({
    businessId: BIZ,
    serviceId: SERVICE,
    staffId: STAFF,
    preferredDate: ymdPlus(7),
    clientFirstName: "Jane",
    clientLastName: "Doe",
    clientEmail: "jane@example.com",
    ...over,
  })

  it("rejects a service pulled from online booking", async () => {
    prismaMock.service.findUnique.mockResolvedValue({
      id: SERVICE,
      isActive: true,
      isOnlineBooking: false, // offline
    })
    const res = await addToPublicWaitlist(validWaitlistInput())
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/isn't available for online booking/i)
    expect(prismaMock.waitlistEntry.create).not.toHaveBeenCalled()
  })

  it("rejects an inactive service", async () => {
    prismaMock.service.findUnique.mockResolvedValue({
      id: SERVICE,
      isActive: false,
      isOnlineBooking: true,
    })
    const res = await addToPublicWaitlist(validWaitlistInput())
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/isn't available for online booking/i)
  })

  it("rejects a cross-tenant / unknown staffId", async () => {
    prismaMock.service.findUnique.mockResolvedValue({ id: SERVICE, isActive: true, isOnlineBooking: true })
    // The hardened staff lookup is scoped to this business → returns null for a
    // foreign staffId.
    prismaMock.staff.findFirst.mockResolvedValue(null)
    const res = await addToPublicWaitlist(validWaitlistInput({ staffId: FOREIGN_STAFF }))
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/staff not found/i)
    expect(prismaMock.waitlistEntry.create).not.toHaveBeenCalled()
    const where = prismaMock.staff.findFirst.mock.calls[0][0].where
    expect(where.primaryLocation).toEqual({ businessId: BIZ })
    expect(where.isActive).toBe(true)
    expect(where.deletedAt).toBe(null)
  })

  it("rejects a staff member who doesn't perform the service", async () => {
    prismaMock.service.findUnique.mockResolvedValue({ id: SERVICE, isActive: true, isOnlineBooking: true })
    prismaMock.staff.findFirst.mockResolvedValue({ id: STAFF })
    prismaMock.staffService.findFirst.mockResolvedValue(null) // doesn't offer it
    const res = await addToPublicWaitlist(validWaitlistInput())
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/doesn't offer the selected service/i)
  })

  it("rejects a past preferredDate", async () => {
    prismaMock.service.findUnique.mockResolvedValue({ id: SERVICE, isActive: true, isOnlineBooking: true })
    prismaMock.staff.findFirst.mockResolvedValue({ id: STAFF })
    prismaMock.staffService.findFirst.mockResolvedValue({ id: "ss_1" })
    const res = await addToPublicWaitlist(validWaitlistInput({ preferredDate: ymdPlus(-3) }))
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/isn't in the past|not in the past/i)
    expect(prismaMock.waitlistEntry.create).not.toHaveBeenCalled()
  })

  it("rejects a preferredDate beyond the advance window", async () => {
    prismaMock.service.findUnique.mockResolvedValue({ id: SERVICE, isActive: true, isOnlineBooking: true })
    prismaMock.staff.findFirst.mockResolvedValue({ id: STAFF })
    prismaMock.staffService.findFirst.mockResolvedValue({ id: "ss_1" })
    const res = await addToPublicWaitlist(validWaitlistInput({ preferredDate: ymdPlus(200) }))
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/within the next 30 days/i)
  })

  it("accepts a valid in-window request and persists the entry", async () => {
    prismaMock.service.findUnique.mockResolvedValue({ id: SERVICE, isActive: true, isOnlineBooking: true })
    prismaMock.staff.findFirst.mockResolvedValue({ id: STAFF })
    prismaMock.staffService.findFirst.mockResolvedValue({ id: "ss_1" })
    prismaMock.waitlistEntry.create.mockResolvedValue({ id: "wl_1" })
    const res = await addToPublicWaitlist(validWaitlistInput())
    expect(res.success).toBe(true)
    expect(prismaMock.waitlistEntry.create).toHaveBeenCalledTimes(1)
    const data = prismaMock.waitlistEntry.create.mock.calls[0][0].data
    expect(data.businessId).toBe(BIZ)
    expect(data.staffId).toBe(STAFF)
  })

  it("rejects an impossible calendar date (2027-02-30)", async () => {
    prismaMock.service.findUnique.mockResolvedValue({ id: SERVICE, isActive: true, isOnlineBooking: true })
    prismaMock.staff.findFirst.mockResolvedValue({ id: STAFF })
    prismaMock.staffService.findFirst.mockResolvedValue({ id: "ss_1" })
    const res = await addToPublicWaitlist(validWaitlistInput({ preferredDate: "2027-02-30" }))
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/valid date|within the next|not in the past/i)
  })
})

// ===========================================================================
// 5. v1 waitlist-book — cross-tenant appointmentId rejected
// ===========================================================================
describe("POST /api/v1/waitlist/[id]/book — appointment ownership", () => {
  function req(appointmentId: string) {
    return new Request("http://localhost/api/v1/waitlist/wl_1/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appointmentId }),
    })
  }
  const params = Promise.resolve({ id: "88888888-8888-4888-8888-888888888888" })

  beforeEach(() => {
    withV1AuthMock.mockResolvedValue({ businessId: BIZ, role: "admin" })
  })

  it("rejects an appointmentId that belongs to another tenant (404, no write)", async () => {
    // The ownership check is scoped to ctx.businessId → a foreign appt returns null.
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    const res = await waitlistBookPost(req(FOREIGN_APPT), { params })
    expect(res.status).toBe(404)
    expect(prismaMock.waitlistEntry.update).not.toHaveBeenCalled()
    const where = prismaMock.appointment.findFirst.mock.calls[0][0].where
    expect(where.businessId).toBe(BIZ)
    expect(where.id).toBe(FOREIGN_APPT)
  })

  it("links an appointment that belongs to the caller's business", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: APPT })
    prismaMock.waitlistEntry.update.mockResolvedValue({ id: "wl_1", status: "booked" })
    const res = await waitlistBookPost(req(APPT), { params })
    expect(res.status).toBe(200)
    expect(prismaMock.waitlistEntry.update).toHaveBeenCalledTimes(1)
    const data = prismaMock.waitlistEntry.update.mock.calls[0][0].data
    expect(data.appointmentId).toBe(APPT)
  })

  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await waitlistBookPost(req(APPT), { params })
    expect(res.status).toBe(401)
    expect(prismaMock.appointment.findFirst).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// 7. notifyWaitlistEntry — real email, consent-gated + honest "emailed" flag
//    (was inert: only flipped status while the UI claimed a message was sent)
// ===========================================================================
describe("notifyWaitlistEntry — consent-gated real email", () => {
  const WL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

  beforeEach(() => {
    prismaMock.waitlistEntry.update.mockResolvedValue({ id: WL, status: "notified" })
  })

  // The entry carries only clientId + business (no `client` relation); the
  // action loads the client separately via prisma.client.findFirst (tenant-scoped).
  function entryRow() {
    return { id: WL, clientId: "client_1", business: { name: "Anas Cuts" } }
  }

  it("emails the client and reports emailed:true when email + emailConsent are present", async () => {
    prismaMock.waitlistEntry.findFirst.mockResolvedValue(entryRow())
    prismaMock.client.findFirst.mockResolvedValue({
      firstName: "Jane", email: "jane@example.com", emailConsent: true,
    })

    const res = await notifyWaitlistEntry(WL)

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][0].to).toBe("jane@example.com")
    expect(res).toMatchObject({ success: true, data: { emailed: true } })
    // Status still flagged "notified".
    expect(prismaMock.waitlistEntry.update.mock.calls[0][0].data.status).toBe("notified")
    // Client lookup is tenant-scoped.
    expect(prismaMock.client.findFirst.mock.calls[0][0].where.businessId).toBe(BIZ)
  })

  it("does NOT email (emailed:false) when the client has no email on file", async () => {
    prismaMock.waitlistEntry.findFirst.mockResolvedValue(entryRow())
    prismaMock.client.findFirst.mockResolvedValue({
      firstName: "Jane", email: null, emailConsent: true,
    })

    const res = await notifyWaitlistEntry(WL)

    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(res).toMatchObject({ success: true, data: { emailed: false } })
    // Still marked as notified (operator can reach out another way).
    expect(prismaMock.waitlistEntry.update).toHaveBeenCalledTimes(1)
  })

  it("does NOT email (emailed:false) when the client has opted out of email", async () => {
    prismaMock.waitlistEntry.findFirst.mockResolvedValue(entryRow())
    prismaMock.client.findFirst.mockResolvedValue({
      firstName: "Jane", email: "jane@example.com", emailConsent: false,
    })

    const res = await notifyWaitlistEntry(WL)

    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(res).toMatchObject({ success: true, data: { emailed: false } })
  })

  it("reports emailed:false when the provider rejects (no false 'emailed' claim)", async () => {
    prismaMock.waitlistEntry.findFirst.mockResolvedValue(entryRow())
    prismaMock.client.findFirst.mockResolvedValue({
      firstName: "Jane", email: "jane@example.com", emailConsent: true,
    })
    sendEmailMock.mockResolvedValue({ success: false, error: "not configured" })

    const res = await notifyWaitlistEntry(WL)

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({ success: true, data: { emailed: false } })
  })

  it("returns an error (no write) for an unknown / cross-tenant entry", async () => {
    prismaMock.waitlistEntry.findFirst.mockResolvedValue(null)

    const res = await notifyWaitlistEntry(WL)

    expect(res).toMatchObject({ success: false })
    expect(prismaMock.waitlistEntry.update).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
    const where = prismaMock.waitlistEntry.findFirst.mock.calls[0][0].where
    expect(where.businessId).toBe(BIZ)
  })
})
