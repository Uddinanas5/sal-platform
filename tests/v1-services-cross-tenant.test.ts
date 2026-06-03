import { describe, it, expect, beforeEach, vi } from "vitest"

// Guards the services cross-tenant write (BUG-2026-05-25): POST /api/v1/services
// must (a) ALWAYS persist under the caller's ctx.businessId, never a businessId
// from the request body, and (b) reject a categoryId that belongs to another
// tenant. Mocks prisma + v1 auth — no DB.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    serviceCategory: { findFirst: vi.fn() },
    service: { create: vi.fn() },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { POST } from "@/app/api/v1/services/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_BIZ = "99999999-9999-4999-8999-999999999999"
const CAT = "22222222-2222-4222-8222-222222222222"

function req(body: unknown) {
  return new Request("http://localhost/api/v1/services", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = (extra?: Record<string, unknown>) => ({
  name: "Cut & Style",
  duration: 45,
  price: 60,
  categoryId: CAT,
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ businessId: BIZ, role: "admin" })
  prismaMock.serviceCategory.findFirst.mockResolvedValue({ id: CAT })
  prismaMock.service.create.mockResolvedValue({ id: "svc_1", businessId: BIZ })
})

describe("POST /api/v1/services — tenant isolation", () => {
  it("ignores a businessId in the request body and writes under ctx.businessId", async () => {
    const res = await POST(req(validBody({ businessId: FOREIGN_BIZ })), undefined as never)
    expect(res.status).toBe(201)
    expect(prismaMock.service.create).toHaveBeenCalledTimes(1)
    const createArg = prismaMock.service.create.mock.calls[0][0]
    expect(createArg.data.businessId).toBe(BIZ)
    expect(createArg.data.businessId).not.toBe(FOREIGN_BIZ)
  })

  it("scopes the category lookup to the caller's business and 400s a foreign category", async () => {
    // Category not found under THIS business → rejected.
    prismaMock.serviceCategory.findFirst.mockResolvedValue(null)
    const res = await POST(req(validBody()), undefined as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/category not found/i)
    expect(prismaMock.serviceCategory.findFirst).toHaveBeenCalledWith({
      where: { id: CAT, businessId: BIZ },
      select: { id: true },
    })
    expect(prismaMock.service.create).not.toHaveBeenCalled()
  })

  it("401s when unauthenticated and 403s for non-admins", async () => {
    withV1AuthMock.mockResolvedValue(null)
    expect((await POST(req(validBody()), undefined as never)).status).toBe(401)
    withV1AuthMock.mockResolvedValue({ businessId: BIZ, role: "staff" })
    expect((await POST(req(validBody()), undefined as never)).status).toBe(403)
  })
})
