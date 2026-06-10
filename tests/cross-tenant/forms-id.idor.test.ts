import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression for /api/v1/forms/[id] (PATCH, DELETE).
// A FormTemplate owned by another business must be unreachable: the route
// scopes every write by ctx.businessId, so Prisma can't find the foreign row
// and the handler maps the miss to 404 NOT_FOUND. Also guards the 401
// (unauthenticated) and 403 (staff role) gates. Mocks prisma + v1 auth; the
// real hasRole pure function is exercised, not mocked.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    formTemplate: { update: vi.fn(), delete: vi.fn() },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { PATCH, DELETE } from "@/app/api/v1/forms/[id]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"

// Mimics Prisma's "record to update/delete not found" runtime error.
class PrismaP2025 extends Error {
  code = "P2025"
  constructor() {
    super("An operation failed because it depends on one or more records that were required but not found.")
  }
}

function patchReq(body: unknown = { name: "Renamed Intake Form" }) {
  return new Request(`http://localhost/api/v1/forms/${FOREIGN_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteReq() {
  return new Request(`http://localhost/api/v1/forms/${FOREIGN_ID}`, {
    method: "DELETE",
  })
}

const params = { params: Promise.resolve({ id: FOREIGN_ID }) } as never

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
  // Foreign-owned id is structurally unreachable under the caller's businessId,
  // so Prisma reports "record not found".
  prismaMock.formTemplate.update.mockRejectedValue(new PrismaP2025())
  prismaMock.formTemplate.delete.mockRejectedValue(new PrismaP2025())
})

describe("PATCH /api/v1/forms/[id] — tenant isolation", () => {
  it("404s a foreign-owned id and scopes the update by the caller's businessId", async () => {
    const res = await PATCH(patchReq(), params)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.formTemplate.update).toHaveBeenCalledTimes(1)
    const arg = prismaMock.formTemplate.update.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(arg.where.businessId).toBe(BIZ)
    expect(arg.where.id).toBe(FOREIGN_ID)
  })

  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await PATCH(patchReq(), params)
    expect(res.status).toBe(401)
    expect(prismaMock.formTemplate.update).not.toHaveBeenCalled()
  })

  it("403s for the staff role (admin gate)", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await PATCH(patchReq(), params)
    expect(res.status).toBe(403)
    expect(prismaMock.formTemplate.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/v1/forms/[id] — tenant isolation", () => {
  it("404s a foreign-owned id and scopes the delete by the caller's businessId", async () => {
    const res = await DELETE(deleteReq(), params)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.formTemplate.delete).toHaveBeenCalledTimes(1)
    const arg = prismaMock.formTemplate.delete.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(arg.where.businessId).toBe(BIZ)
    expect(arg.where.id).toBe(FOREIGN_ID)
  })

  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await DELETE(deleteReq(), params)
    expect(res.status).toBe(401)
    expect(prismaMock.formTemplate.delete).not.toHaveBeenCalled()
  })

  it("403s for the staff role (admin gate)", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await DELETE(deleteReq(), params)
    expect(res.status).toBe(403)
    expect(prismaMock.formTemplate.delete).not.toHaveBeenCalled()
  })
})
