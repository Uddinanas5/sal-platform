import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression for GET/PATCH/DELETE /api/v1/appointments/[id].
//
// Threat model: an authenticated caller from business BIZ supplies the id of an
// appointment owned by ANOTHER tenant (FOREIGN_ID). The route must never read or
// write that foreign row. Two layered defenses must hold:
//   1. canAccessAppointment(ctx, id) gate — denies (403) before any DB touch.
//   2. Even if the gate passes, every prisma.appointment.{findUnique,update}
//      carries `businessId: ctx.businessId` in its `where`, so a foreign row is
//      structurally unreachable → 404 (and any P2025 from update maps to 404).
//
// We test BOTH: the gate-denies path (403) AND the gate-allows-but-scoped path
// (404 + assert the where carries BIZ, never the foreign tenant). Plus 401 when
// unauthenticated, and 403 for a staff caller the REAL gate rejects (hasRole is
// a pure fn — NOT mocked here; the staff test lets the real gate run and only
// stubs the prisma lookups it makes to deny ownership).
//
// Mocks prisma + v1 auth — no DB.

const { prismaMock, withV1AuthMock, canAccessAppointmentMock } = vi.hoisted(() => ({
  prismaMock: {
    appointment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    // Used only by the REAL canAccessAppointment in the staff-role test.
    staff: { findFirst: vi.fn() },
    appointmentService: { findFirst: vi.fn() },
  },
  withV1AuthMock: vi.fn(),
  canAccessAppointmentMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))
// Default: mock the access gate so the gate-allows path can exercise the
// businessId-scoped DB queries. Individual tests override / unmock as needed.
vi.mock("@/lib/api/appointment-access", () => ({
  canAccessAppointment: canAccessAppointmentMock,
}))

import { GET, PATCH, DELETE } from "@/app/api/v1/appointments/[id]/route"

// The genuine gate implementation (the module is mocked above, so a normal
// import would just return the mock). vi.importActual bypasses the mock and
// gives us the real canAccessAppointment, which still reads the mocked prisma.
async function loadRealGate() {
  const actual = await vi.importActual<
    typeof import("@/lib/api/appointment-access")
  >("@/lib/api/appointment-access")
  return actual.canAccessAppointment
}

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"
const FOREIGN_BIZ = "33333333-3333-4333-8333-333333333333"

// [id] route handler signature: 2nd arg is { params: Promise<{ id }> }.
const ctxArg = (id: string) => ({ params: Promise.resolve({ id }) }) as never

function getReq() {
  return new Request(`http://localhost/api/v1/appointments/${FOREIGN_ID}`, {
    method: "GET",
  })
}
function patchReq(body: unknown = { status: "completed" }) {
  return new Request(`http://localhost/api/v1/appointments/${FOREIGN_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
function deleteReq() {
  return new Request(`http://localhost/api/v1/appointments/${FOREIGN_ID}`, {
    method: "DELETE",
  })
}

// A Prisma "record not found" error: appointment.update against a row outside
// the caller's businessId throws P2025, which the route catches → NOT_FOUND.
function p2025() {
  const e = new Error("Record to update not found.") as Error & { code: string }
  e.code = "P2025"
  return e
}

// Inspect every where the route built for a model.op and assert tenant scoping.
function assertAllWheresScopedToBiz(
  calls: unknown[][],
  label: string
) {
  expect(calls.length, `${label} should have been called`).toBeGreaterThan(0)
  for (const call of calls) {
    const where = (call[0] as { where?: { businessId?: string } } | undefined)?.where
    expect(where?.businessId, `${label} where.businessId`).toBe(BIZ)
    expect(where?.businessId, `${label} must not target foreign tenant`).not.toBe(FOREIGN_BIZ)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
  // Default gate: allow, so we can exercise the scoped DB layer.
  canAccessAppointmentMock.mockResolvedValue(true)
  // Scoped reads find nothing (the foreign row is invisible under BIZ).
  prismaMock.appointment.findUnique.mockResolvedValue(null)
  prismaMock.appointment.update.mockRejectedValue(p2025())
})

describe("GET /api/v1/appointments/[id] — cross-tenant IDOR", () => {
  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await GET(getReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    expect(prismaMock.appointment.findUnique).not.toHaveBeenCalled()
  })

  it("403s when the access gate denies a foreign appointment", async () => {
    canAccessAppointmentMock.mockResolvedValue(false)
    const res = await GET(getReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    expect(canAccessAppointmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BIZ }),
      FOREIGN_ID
    )
    // Gate denied before any DB read — no foreign row touched.
    expect(prismaMock.appointment.findUnique).not.toHaveBeenCalled()
  })

  it("404s (not the foreign row) when the gate allows but the read is businessId-scoped", async () => {
    const res = await GET(getReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    assertAllWheresScopedToBiz(
      prismaMock.appointment.findUnique.mock.calls as unknown[][],
      "appointment.findUnique"
    )
    // The where targeted the foreign id but under the caller's tenant only.
    const where = (prismaMock.appointment.findUnique.mock.calls[0][0] as {
      where: { id: string; businessId: string }
    }).where
    expect(where.id).toBe(FOREIGN_ID)
    expect(where.businessId).toBe(BIZ)
  })
})

describe("PATCH /api/v1/appointments/[id] — cross-tenant IDOR (status update)", () => {
  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await PATCH(patchReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it("403s when the access gate denies a foreign appointment — and never writes", async () => {
    canAccessAppointmentMock.mockResolvedValue(false)
    const res = await PATCH(patchReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it("404s and the write is businessId-scoped (foreign row unreachable, no cross-tenant mutation)", async () => {
    const res = await PATCH(patchReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    // The update was attempted but constrained to the caller's tenant; Prisma
    // P2025 (no matching row under BIZ) mapped to 404 — the foreign row was
    // never updated.
    assertAllWheresScopedToBiz(
      prismaMock.appointment.update.mock.calls as unknown[][],
      "appointment.update"
    )
    const where = (prismaMock.appointment.update.mock.calls[0][0] as {
      where: { id: string; businessId: string }
    }).where
    expect(where.id).toBe(FOREIGN_ID)
    expect(where.businessId).toBe(BIZ)
  })
})

describe("DELETE /api/v1/appointments/[id] — cross-tenant IDOR (cancel)", () => {
  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await DELETE(deleteReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it("403s when the access gate denies a foreign appointment — and never writes", async () => {
    canAccessAppointmentMock.mockResolvedValue(false)
    const res = await DELETE(deleteReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it("404s and the cancel write is businessId-scoped (foreign row unreachable)", async () => {
    const res = await DELETE(deleteReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    assertAllWheresScopedToBiz(
      prismaMock.appointment.update.mock.calls as unknown[][],
      "appointment.update"
    )
    const arg = prismaMock.appointment.update.mock.calls[0][0] as {
      where: { id: string; businessId: string }
      data: { status: string }
    }
    expect(arg.where.id).toBe(FOREIGN_ID)
    expect(arg.where.businessId).toBe(BIZ)
    // It is a soft-cancel, not a hard read of foreign data.
    expect(arg.data.status).toBe("cancelled")
  })
})

describe("access gate — staff role denied on a foreign appointment (real predicate)", () => {
  it("the REAL canAccessAppointment returns false for a staff caller who owns no matching staff profile under BIZ", async () => {
    // hasRole is pure & unmocked: a "staff" role is below "admin", so the gate
    // falls through to the businessId-scoped staff/assignment lookups. With no
    // matching staff profile in BIZ, the gate denies — the basis for the 403.
    prismaMock.staff.findFirst.mockResolvedValue(null)
    const realCanAccessAppointment = await loadRealGate()
    const allowed = await realCanAccessAppointment(
      { userId: "u1", businessId: BIZ, role: "staff" },
      FOREIGN_ID
    )
    expect(allowed).toBe(false)
    // The ownership lookup was scoped to the caller's business.
    const staffWhere = (prismaMock.staff.findFirst.mock.calls[0][0] as {
      where: { userId: string; primaryLocation: { businessId: string } }
    }).where
    expect(staffWhere.userId).toBe("u1")
    expect(staffWhere.primaryLocation.businessId).toBe(BIZ)
    // No assignment lookup happens once the staff profile is absent.
    expect(prismaMock.appointmentService.findFirst).not.toHaveBeenCalled()
  })

  it("GET 403s end-to-end for that denied staff caller (gate wired into the route)", async () => {
    // Drive the route with the REAL gate by routing the mocked gate through the
    // real implementation for this one case.
    const realCanAccessAppointment = await loadRealGate()
    canAccessAppointmentMock.mockImplementation((ctx, id) =>
      realCanAccessAppointment(ctx, id)
    )
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    prismaMock.staff.findFirst.mockResolvedValue(null)

    const res = await GET(getReq(), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    // Denied before any appointment read.
    expect(prismaMock.appointment.findUnique).not.toHaveBeenCalled()
  })
})
