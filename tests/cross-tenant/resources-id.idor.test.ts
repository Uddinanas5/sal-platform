import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression for PATCH/DELETE /api/v1/resources/[id].
// A caller authenticated under businessId BIZ must never be able to mutate or
// delete a Resource owned by another tenant. The route enforces this by
// carrying `businessId: ctx.businessId` in the Prisma `where` clause — so a
// foreign-owned row is structurally unreachable and Prisma throws P2025, which
// the route maps to 404 NOT_FOUND. Also guards the 401 (no auth) and 403
// (staff role) gates. hasRole is a real pure function and is NOT mocked.
// Mocks prisma + v1 auth — no DB.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    service: { count: vi.fn() },
    resource: { update: vi.fn(), delete: vi.fn() },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { PATCH, DELETE } from "@/app/api/v1/resources/[id]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"

// Simulates Prisma's "record to update/delete not found" error.
function p2025(): Error {
  const e = new Error("Record to update not found.") as Error & { code: string }
  e.code = "P2025"
  return e
}

const params = { params: Promise.resolve({ id: FOREIGN_ID }) } as never

function patchReq(body: unknown) {
  return new Request(`http://localhost/api/v1/resources/${FOREIGN_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteReq() {
  return new Request(`http://localhost/api/v1/resources/${FOREIGN_ID}`, {
    method: "DELETE",
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
  // Foreign row is unreachable under the caller's businessId → Prisma P2025.
  prismaMock.resource.update.mockRejectedValue(p2025())
  prismaMock.resource.delete.mockRejectedValue(p2025())
  prismaMock.service.count.mockResolvedValue(0)
})

describe("PATCH /api/v1/resources/[id] — tenant isolation (IDOR)", () => {
  it("returns 404 for a foreign-owned resource id", async () => {
    const res = await PATCH(patchReq({ name: "Hijacked" }), params)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")
  })

  it("scopes the update where-clause to the caller's businessId", async () => {
    await PATCH(patchReq({ name: "Hijacked" }), params)
    expect(prismaMock.resource.update).toHaveBeenCalledTimes(1)
    const arg = prismaMock.resource.update.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(arg.where.id).toBe(FOREIGN_ID)
    expect(arg.where.businessId).toBe(BIZ)
  })

  it("scopes the serviceIds ownership check to the caller's businessId", async () => {
    const svc = "22222222-2222-4222-8222-222222222222"
    // count returns < requested → foreign service rejected with 400, no update.
    prismaMock.service.count.mockResolvedValue(0)
    const res = await PATCH(patchReq({ serviceIds: [svc] }), params)
    expect(res.status).toBe(400)
    expect(prismaMock.service.count).toHaveBeenCalledTimes(1)
    const arg = prismaMock.service.count.mock.calls[0][0] as unknown as {
      where: { businessId: string }
    }
    expect(arg.where.businessId).toBe(BIZ)
    expect(prismaMock.resource.update).not.toHaveBeenCalled()
  })

  it("returns 401 when unauthenticated and never touches the DB", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await PATCH(patchReq({ name: "x" }), params)
    expect(res.status).toBe(401)
    expect(prismaMock.resource.update).not.toHaveBeenCalled()
  })

  it("returns 403 for the staff role and never touches the DB", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await PATCH(patchReq({ name: "x" }), params)
    expect(res.status).toBe(403)
    expect(prismaMock.resource.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/v1/resources/[id] — tenant isolation (IDOR)", () => {
  it("returns 404 for a foreign-owned resource id", async () => {
    const res = await DELETE(deleteReq(), params)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")
  })

  it("scopes the delete where-clause to the caller's businessId", async () => {
    await DELETE(deleteReq(), params)
    expect(prismaMock.resource.delete).toHaveBeenCalledTimes(1)
    const arg = prismaMock.resource.delete.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(arg.where.id).toBe(FOREIGN_ID)
    expect(arg.where.businessId).toBe(BIZ)
  })

  it("returns 401 when unauthenticated and never touches the DB", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await DELETE(deleteReq(), params)
    expect(res.status).toBe(401)
    expect(prismaMock.resource.delete).not.toHaveBeenCalled()
  })

  it("returns 403 for the staff role and never touches the DB", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await DELETE(deleteReq(), params)
    expect(res.status).toBe(403)
    expect(prismaMock.resource.delete).not.toHaveBeenCalled()
  })
})
