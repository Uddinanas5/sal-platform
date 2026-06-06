import { describe, it, expect, beforeEach, vi } from "vitest"

// Guards finding: the v1 service `toggle` must NOT resurrect a soft-deleted
// service to isActive=true (which would leave it bookable with deletedAt still
// set). The toggle read+write are now scoped deletedAt:null, so a soft-deleted
// service collapses to NOT_FOUND. Mock-Prisma (vi.hoisted) — no DB.

const { prismaMock, withV1AuthMock, hasRoleMock } = vi.hoisted(() => ({
  prismaMock: {
    service: { findUnique: vi.fn(), update: vi.fn() },
  },
  withV1AuthMock: vi.fn(),
  hasRoleMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))
vi.mock("@/lib/permissions", () => ({ hasRole: hasRoleMock }))

import { PATCH } from "@/app/api/v1/services/[id]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const SVC = "22222222-2222-4222-8222-222222222222"

function toggleReq() {
  return new Request(`http://localhost/api/v1/services/${SVC}?action=toggle`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
}
const params = Promise.resolve({ id: SVC })

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ businessId: BIZ, role: "admin" })
  hasRoleMock.mockReturnValue(true)
})

describe("PATCH /api/v1/services/[id]?action=toggle — soft-delete guard", () => {
  it("404s on a soft-deleted service (read scoped deletedAt:null, no resurrect)", async () => {
    // findUnique with deletedAt:null returns null for a soft-deleted service.
    prismaMock.service.findUnique.mockResolvedValue(null)
    const res = await PATCH(toggleReq(), { params })
    expect(res.status).toBe(404)
    expect(prismaMock.service.update).not.toHaveBeenCalled()
    const where = prismaMock.service.findUnique.mock.calls[0][0].where
    expect(where.deletedAt).toBe(null)
    expect(where.businessId).toBe(BIZ)
  })

  it("toggles a live service and scopes the update deletedAt:null", async () => {
    prismaMock.service.findUnique.mockResolvedValue({ id: SVC, isActive: false })
    prismaMock.service.update.mockResolvedValue({ id: SVC, isActive: true })
    const res = await PATCH(toggleReq(), { params })
    expect(res.status).toBe(200)
    expect(prismaMock.service.update).toHaveBeenCalledTimes(1)
    const where = prismaMock.service.update.mock.calls[0][0].where
    expect(where.deletedAt).toBe(null)
    const data = prismaMock.service.update.mock.calls[0][0].data
    expect(data.isActive).toBe(true) // !false
  })

  it("403s for non-admins", async () => {
    hasRoleMock.mockReturnValue(false)
    const res = await PATCH(toggleReq(), { params })
    expect(res.status).toBe(403)
  })
})
