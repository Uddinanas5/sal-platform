import { describe, it, expect, beforeEach, vi } from "vitest"

// GROUP SECURITY — two access-control holes, one mock-Prisma suite (no DB):
//
//  1. GET /api/v1/appointments — a staff-role session calling ?staffId=<colleagueId>
//     used to read other staff's appointments + client PII within the tenant
//     (dead identical-branch ternary nullified the self-scope). The fix forces
//     ctx.role === "staff" to ALWAYS scope where.services.some.staffId to the
//     caller's own active staff profile, ignoring any client-supplied staffId.
//  2. GET /api/calendar/[appointmentId] — loaded an appointment by id alone with
//     no businessId scope, leaking ICS client PII cross-tenant to any logged-in
//     user. The fix adds getBusinessContext() + a businessId-scoped findFirst
//     that 404s a foreign-tenant id.

const { prismaMock, withV1AuthMock, getBusinessContextMock } = vi.hoisted(() => ({
  prismaMock: {
    staff: { findFirst: vi.fn() },
    appointment: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  },
  withV1AuthMock: vi.fn(),
  getBusinessContextMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))
vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: getBusinessContextMock }))

import { GET as appointmentsGET } from "@/app/api/v1/appointments/route"
import { GET as calendarGET } from "@/app/api/calendar/[appointmentId]/route"

// Valid v4 UUIDs.
const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_BIZ = "99999999-9999-4999-8999-999999999999"
const USER = "55555555-5555-4555-8555-555555555555"
const OWN_STAFF = "22222222-2222-4222-8222-222222222222"
const COLLEAGUE_STAFF = "33333333-3333-4333-8333-333333333333"
const APPT = "44444444-4444-4444-8444-444444444444"

function appointmentsReq(query = "") {
  return new Request(`http://localhost/api/v1/appointments${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.appointment.findMany.mockResolvedValue([])
  prismaMock.appointment.count.mockResolvedValue(0)
})

// ===========================================================================
// 1. GET /api/v1/appointments — staff self-scope (no colleague leak)
// ===========================================================================
describe("GET /api/v1/appointments — staff self-scope", () => {
  it("ignores a client-supplied ?staffId and scopes a staff caller to their OWN profile id", async () => {
    withV1AuthMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "staff" })
    // The caller's resolved active staff profile.
    prismaMock.staff.findFirst.mockResolvedValue({ id: OWN_STAFF })

    // Staff tries to read a colleague's appointments via ?staffId=<colleague>.
    const res = await appointmentsGET(appointmentsReq(`?staffId=${COLLEAGUE_STAFF}`))
    expect(res.status).toBe(200)

    // The profile lookup is keyed on the SESSION user, not the supplied staffId,
    // and only resolves an ACTIVE profile.
    expect(prismaMock.staff.findFirst).toHaveBeenCalledWith({
      where: { userId: USER, isActive: true },
      select: { id: true },
    })

    // The query was scoped to the caller's OWN staff id — never the supplied one.
    const where = prismaMock.appointment.findMany.mock.calls[0][0].where
    expect(where.businessId).toBe(BIZ)
    expect(where.services).toEqual({ some: { staffId: OWN_STAFF } })
    expect(JSON.stringify(where)).not.toContain(COLLEAGUE_STAFF)
  })

  it("scopes a staff caller to a non-matching id (empty result) when no active staff profile exists — never unfiltered", async () => {
    withV1AuthMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "staff" })
    prismaMock.staff.findFirst.mockResolvedValue(null)

    const res = await appointmentsGET(appointmentsReq(`?staffId=${COLLEAGUE_STAFF}`))
    expect(res.status).toBe(200)

    const where = prismaMock.appointment.findMany.mock.calls[0][0].where
    // A staff filter is ALWAYS present (never falls through unfiltered), and it
    // matches nothing so the result set is empty.
    expect(where.services).toBeDefined()
    expect(where.services.some.staffId).not.toBe(COLLEAGUE_STAFF)
    expect(where.services.some.staffId).not.toBeUndefined()
    expect(where.services.some.staffId).not.toBeNull()
  })

  it("lets an admin filter by an arbitrary staffId (and never runs the staff self-scope lookup)", async () => {
    withV1AuthMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "admin" })

    const res = await appointmentsGET(appointmentsReq(`?staffId=${COLLEAGUE_STAFF}`))
    expect(res.status).toBe(200)

    // Admin retains arbitrary staffId filtering.
    const where = prismaMock.appointment.findMany.mock.calls[0][0].where
    expect(where.services).toEqual({ some: { staffId: COLLEAGUE_STAFF } })
    // The self-scope profile lookup is staff-only.
    expect(prismaMock.staff.findFirst).not.toHaveBeenCalled()
  })

  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await appointmentsGET(appointmentsReq())
    expect(res.status).toBe(401)
    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// 2. GET /api/calendar/[appointmentId] — tenant-scoped ICS
// ===========================================================================
describe("GET /api/calendar/[appointmentId] — tenant isolation", () => {
  it("404s a foreign-tenant appointment id and scopes the lookup by businessId", async () => {
    getBusinessContextMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "admin" })
    // A foreign-tenant appointment resolves to null under the caller's businessId.
    prismaMock.appointment.findFirst.mockResolvedValue(null)

    const res = await calendarGET({} as never, { params: { appointmentId: APPT } })

    expect(res.status).toBe(404)
    // The lookup carried the caller's businessId — not just the bare id.
    const where = prismaMock.appointment.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ id: APPT, businessId: BIZ })
    expect(where.businessId).not.toBe(FOREIGN_BIZ)
  })

  it("returns the ICS for an in-tenant appointment", async () => {
    getBusinessContextMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "admin" })
    prismaMock.appointment.findFirst.mockResolvedValue({
      id: APPT,
      bookingReference: "SAL-ABC-1234",
      status: "confirmed",
      notes: null,
      startTime: new Date("2026-06-10T14:00:00Z"),
      endTime: new Date("2026-06-10T15:00:00Z"),
      client: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
      business: { name: "Salon A", email: "hi@salona.com" },
      services: [{ service: { name: "Haircut" }, staff: { user: { firstName: "Sam", lastName: "Stylist" } } }],
      location: { name: "Main", addressLine1: "1 St", city: "NYC", state: "NY", postalCode: "10001" },
    })

    const res = await calendarGET({} as never, { params: { appointmentId: APPT } })

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("text/calendar")
    const body = await res.text()
    expect(body).toContain("BEGIN:VCALENDAR")
    expect(body).toContain("SAL-ABC-1234")
  })
})
