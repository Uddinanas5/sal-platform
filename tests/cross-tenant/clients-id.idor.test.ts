import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression for PATCH/DELETE /api/v1/clients/[id].
// A tenant (businessId) must never read, update, or soft-delete a client that
// belongs to another tenant. The route scopes every write with
// where:{ id, businessId: ctx.businessId } and maps a Prisma P2025 (record not
// found) to a 404 — so a foreign-owned id is structurally unreachable.
// Mocks prisma + v1 auth; hasRole is a real pure function and is NOT mocked.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    client: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { PATCH, DELETE } from "@/app/api/v1/clients/[id]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"

// A Prisma "record not found" error shape: an Error whose .code === "P2025".
function prismaP2025() {
  const e = new Error("Record to update not found.") as Error & { code: string }
  e.code = "P2025"
  return e
}

function patchReq(body: unknown) {
  return new Request(`http://localhost/api/v1/clients/${FOREIGN_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteReq() {
  return new Request(`http://localhost/api/v1/clients/${FOREIGN_ID}`, {
    method: "DELETE",
  })
}

const foreignParams = { params: Promise.resolve({ id: FOREIGN_ID }) } as never

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
  prismaMock.client.findFirst.mockResolvedValue(null)
  // Foreign-owned id is unreachable under ctx.businessId → Prisma throws P2025.
  prismaMock.client.update.mockRejectedValue(prismaP2025())
})

describe("PATCH /api/v1/clients/[id] — cross-tenant IDOR", () => {
  it("returns 404 for a foreign-owned id (P2025) and scopes the write to ctx.businessId", async () => {
    const res = await PATCH(patchReq({ firstName: "Mallory" }), foreignParams)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.client.update).toHaveBeenCalledTimes(1)
    const updateArg = prismaMock.client.update.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(updateArg.where.businessId).toBe(BIZ)
    expect(updateArg.where.id).toBe(FOREIGN_ID)
  })

  it("scopes the email-uniqueness lookup to ctx.businessId", async () => {
    const res = await PATCH(patchReq({ email: "Foo@Example.COM" }), foreignParams)
    // findFirst returns null (no dupe in THIS business) → proceeds to update,
    // which throws P2025 → 404. The point is the lookup is businessId-scoped.
    expect(res.status).toBe(404)

    expect(prismaMock.client.findFirst).toHaveBeenCalledTimes(1)
    const findArg = prismaMock.client.findFirst.mock.calls[0][0] as unknown as {
      where: { businessId: string; email: string; id: { not: string } }
    }
    expect(findArg.where.businessId).toBe(BIZ)
    // Email is normalized to lowercase before the lookup.
    expect(findArg.where.email).toBe("foo@example.com")
    expect(findArg.where.id).toEqual({ not: FOREIGN_ID })
  })

  it("returns 401 when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await PATCH(patchReq({ firstName: "Mallory" }), foreignParams)
    expect(res.status).toBe(401)
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/v1/clients/[id] — cross-tenant IDOR", () => {
  it("returns 404 for a foreign-owned id (P2025) and scopes the soft-delete to ctx.businessId", async () => {
    const res = await DELETE(deleteReq(), foreignParams)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.client.update).toHaveBeenCalledTimes(1)
    const updateArg = prismaMock.client.update.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(updateArg.where.businessId).toBe(BIZ)
    expect(updateArg.where.id).toBe(FOREIGN_ID)
  })

  it("returns 401 when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await DELETE(deleteReq(), foreignParams)
    expect(res.status).toBe(401)
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })

  it("returns 403 for the staff role (admin-only delete gate)", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await DELETE(deleteReq(), foreignParams)
    expect(res.status).toBe(403)
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })
})
