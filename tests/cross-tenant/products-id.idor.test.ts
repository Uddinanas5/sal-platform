import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression guard for /api/v1/products/[id] (GET, DELETE).
// A caller in business BIZ must NOT be able to read or delete a product that
// belongs to another tenant. The route enforces this by scoping every Prisma
// lookup/mutation with `businessId: ctx.businessId`, so a foreign row is
// structurally unreachable (findUnique → null → 404; update → P2025 → 404).
// Mocks prisma + v1 auth — no DB. hasRole is a real pure fn, left unmocked.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { GET, DELETE } from "@/app/api/v1/products/[id]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"

function req(method: string) {
  return new Request(`http://localhost/api/v1/products/${FOREIGN_ID}`, { method })
}

// [id] route: 2nd arg is { params: Promise<{ id }> }
const ctx = { params: Promise.resolve({ id: FOREIGN_ID }) } as never

// Prisma's "record to update not found" error shape.
function p2025(): Error {
  const e = new Error("Record to update not found.") as Error & { code: string }
  e.code = "P2025"
  return e
}

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
  // Foreign product is unreachable under BIZ scope: findUnique returns null.
  prismaMock.product.findUnique.mockResolvedValue(null)
  // Foreign product is unreachable under BIZ scope: update can't match → P2025.
  prismaMock.product.update.mockRejectedValue(p2025())
})

describe("GET /api/v1/products/[id] — tenant isolation", () => {
  it("404s on a foreign-owned product id and scopes the lookup to ctx.businessId", async () => {
    const res = await GET(req("GET"), ctx)
    expect(res.status).toBe(404)

    expect(prismaMock.product.findUnique).toHaveBeenCalledTimes(1)
    const arg = prismaMock.product.findUnique.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(arg.where.businessId).toBe(BIZ)
    expect(arg.where.id).toBe(FOREIGN_ID)
  })

  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await GET(req("GET"), ctx)
    expect(res.status).toBe(401)
    expect(prismaMock.product.findUnique).not.toHaveBeenCalled()
  })

  it("403s for a non-admin (staff) caller", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await GET(req("GET"), ctx)
    expect(res.status).toBe(403)
    expect(prismaMock.product.findUnique).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/v1/products/[id] — tenant isolation", () => {
  it("404s on a foreign-owned product id and scopes the update to ctx.businessId", async () => {
    const res = await DELETE(req("DELETE"), ctx)
    expect(res.status).toBe(404)

    expect(prismaMock.product.update).toHaveBeenCalledTimes(1)
    const arg = prismaMock.product.update.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(arg.where.businessId).toBe(BIZ)
    expect(arg.where.id).toBe(FOREIGN_ID)
    expect(arg.where.businessId).not.toBe(FOREIGN_ID)
  })

  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await DELETE(req("DELETE"), ctx)
    expect(res.status).toBe(401)
    expect(prismaMock.product.update).not.toHaveBeenCalled()
  })

  it("403s for a non-admin (staff) caller", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await DELETE(req("DELETE"), ctx)
    expect(res.status).toBe(403)
    expect(prismaMock.product.update).not.toHaveBeenCalled()
  })
})
