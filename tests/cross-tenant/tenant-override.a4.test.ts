import { describe, it, expect, beforeEach, vi } from "vitest"

// GATE A.4 — tenant identity derives from the SERVER SESSION only.
//
// The IDOR suites prove a caller can't reach ANOTHER tenant's row by guessing its
// id (the where is scoped to ctx.businessId). A.4 is the complementary threat: a
// caller tries to OVERRIDE which tenant they operate as by smuggling a hostile
// `businessId` into the request — in the JSON body, the query string, or an
// `X-Tenant-ID` header. OWASP Multi-Tenant Cheat Sheet: tenant id must come from
// the verified session/token, never from client-controlled input.
//
// The v1 appointment route derives businessId ONLY from withV1Auth (the API
// key / session). This test drives it with every client-supplied tenant hint set
// to a FOREIGN business and asserts every Prisma `where` still carries the AUTH
// tenant (BIZ) — so a future regression that did `where.businessId = body.businessId`
// would fail here. Representative of the whole withV1Auth-derived-tenant pattern.
//
// Mocks prisma + v1 auth + the access gate — no DB.

const { prismaMock, withV1AuthMock, canAccessAppointmentMock } = vi.hoisted(() => ({
  prismaMock: {
    appointment: { findUnique: vi.fn(), update: vi.fn() },
  },
  withV1AuthMock: vi.fn(),
  canAccessAppointmentMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))
vi.mock("@/lib/api/appointment-access", () => ({ canAccessAppointment: canAccessAppointmentMock }))

import { GET, PATCH } from "@/app/api/v1/appointments/[id]/route"

// The caller is authenticated to BIZ. FOREIGN_BIZ is the tenant they try to
// impersonate via every client-controlled channel. APPT is a row in THEIR tenant.
const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_BIZ = "33333333-3333-4333-8333-333333333333"
const APPT = "55555555-5555-4555-8555-555555555555"

const ctxArg = (id: string) => ({ params: Promise.resolve({ id }) }) as never

// Every hostile tenant channel at once: query ?businessId=, X-Tenant-ID header,
// and (for PATCH) a businessId field in the JSON body.
function getReqHostile() {
  return new Request(`http://localhost/api/v1/appointments/${APPT}?businessId=${FOREIGN_BIZ}`, {
    method: "GET",
    headers: { "x-tenant-id": FOREIGN_BIZ },
  })
}
function patchReqHostile() {
  return new Request(`http://localhost/api/v1/appointments/${APPT}?businessId=${FOREIGN_BIZ}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-tenant-id": FOREIGN_BIZ },
    body: JSON.stringify({ status: "completed", businessId: FOREIGN_BIZ }),
  })
}

// Assert EVERY where the route built for a model.op is scoped to the auth tenant,
// never the foreign tenant the client tried to inject.
function assertNeverForeign(calls: unknown[][], label: string) {
  expect(calls.length, `${label} should have run`).toBeGreaterThan(0)
  for (const call of calls) {
    const where = (call[0] as { where?: { businessId?: string } } | undefined)?.where
    expect(where?.businessId, `${label} must scope to the AUTH tenant`).toBe(BIZ)
    expect(where?.businessId, `${label} must NOT honor the client-supplied tenant`).not.toBe(FOREIGN_BIZ)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
  canAccessAppointmentMock.mockResolvedValue(true)
  // The row lookup runs scoped to BIZ; return null so we assert the WHERE only.
  prismaMock.appointment.findUnique.mockResolvedValue(null)
})

describe("Gate A.4 — client-supplied tenant (body / query / X-Tenant-ID) is ignored", () => {
  it("GET scopes to the authenticated tenant despite ?businessId= and X-Tenant-ID pointing elsewhere", async () => {
    await GET(getReqHostile(), ctxArg(APPT))
    assertNeverForeign(prismaMock.appointment.findUnique.mock.calls as unknown[][], "appointment.findUnique")
  })

  it("PATCH scopes to the authenticated tenant despite a businessId in the body, query, and header", async () => {
    await PATCH(patchReqHostile(), ctxArg(APPT))
    // The reactivation guard reads the current row scoped to BIZ before writing.
    assertNeverForeign(prismaMock.appointment.findUnique.mock.calls as unknown[][], "appointment.findUnique")
    const where = (prismaMock.appointment.findUnique.mock.calls[0][0] as {
      where: { id: string; businessId: string }
    }).where
    expect(where.id).toBe(APPT)
    expect(where.businessId).toBe(BIZ)
  })

  it("the access gate is asked about the AUTH tenant, not the injected one", async () => {
    await GET(getReqHostile(), ctxArg(APPT))
    expect(canAccessAppointmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BIZ }),
      APPT,
    )
    // Sanity: the gate was never handed the foreign tenant.
    const ctxSeen = canAccessAppointmentMock.mock.calls[0][0] as { businessId: string }
    expect(ctxSeen.businessId).not.toBe(FOREIGN_BIZ)
  })
})
