import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression guard for /api/v1/memberships/plans/[id]
// (PATCH, DELETE). A caller in business BIZ must NOT be able to update or
// delete a membership plan owned by another tenant. The route enforces this by
// scoping every Prisma mutation with `where: { id, businessId: ctx.businessId }`,
// so a foreign row is structurally unreachable (update/delete → P2025 → caught →
// 404 NOT_FOUND). Both methods are admin-gated (401 unauth, 403 staff).
// Mocks prisma + v1 auth — no DB. hasRole is a real pure fn, left unmocked.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    membershipPlan: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { PATCH, DELETE } from "@/app/api/v1/memberships/plans/[id]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"

function patchReq(body: Record<string, unknown> = { name: "Hijacked" }) {
  return new Request(`http://localhost/api/v1/memberships/plans/${FOREIGN_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteReq() {
  return new Request(`http://localhost/api/v1/memberships/plans/${FOREIGN_ID}`, {
    method: "DELETE",
  })
}

// [id] route: 2nd arg is { params: Promise<{ id }> }
const routeCtx = { params: Promise.resolve({ id: FOREIGN_ID }) } as never

// Prisma's "record not found" error shape (thrown by update/delete on no match).
function p2025(): Error {
  const e = new Error("Record to update not found.") as Error & { code: string }
  e.code = "P2025"
  return e
}

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
  // Foreign plan is unreachable under BIZ scope: the where can't match → P2025.
  prismaMock.membershipPlan.update.mockRejectedValue(p2025())
  prismaMock.membershipPlan.delete.mockRejectedValue(p2025())
})

describe("PATCH /api/v1/memberships/plans/[id] — tenant isolation", () => {
  it("404s on a foreign-owned plan id and scopes the update to ctx.businessId", async () => {
    const res = await PATCH(patchReq(), routeCtx)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.membershipPlan.update).toHaveBeenCalledTimes(1)
    const arg = prismaMock.membershipPlan.update.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(arg.where.businessId).toBe(BIZ)
    expect(arg.where.id).toBe(FOREIGN_ID)
    expect(arg.where.businessId).not.toBe(FOREIGN_ID)
  })

  it("401s when unauthenticated and never touches the DB", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await PATCH(patchReq(), routeCtx)
    expect(res.status).toBe(401)
    expect(prismaMock.membershipPlan.update).not.toHaveBeenCalled()
  })

  it("403s for a non-admin (staff) caller and never touches the DB", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await PATCH(patchReq(), routeCtx)
    expect(res.status).toBe(403)
    expect(prismaMock.membershipPlan.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/v1/memberships/plans/[id] — tenant isolation", () => {
  it("404s on a foreign-owned plan id and scopes the delete to ctx.businessId", async () => {
    const res = await DELETE(deleteReq(), routeCtx)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.membershipPlan.delete).toHaveBeenCalledTimes(1)
    const arg = prismaMock.membershipPlan.delete.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(arg.where.businessId).toBe(BIZ)
    expect(arg.where.id).toBe(FOREIGN_ID)
    expect(arg.where.businessId).not.toBe(FOREIGN_ID)
  })

  it("401s when unauthenticated and never touches the DB", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await DELETE(deleteReq(), routeCtx)
    expect(res.status).toBe(401)
    expect(prismaMock.membershipPlan.delete).not.toHaveBeenCalled()
  })

  it("403s for a non-admin (staff) caller and never touches the DB", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await DELETE(deleteReq(), routeCtx)
    expect(res.status).toBe(403)
    expect(prismaMock.membershipPlan.delete).not.toHaveBeenCalled()
  })
})
