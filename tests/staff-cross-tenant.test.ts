import { describe, it, expect, beforeEach, vi } from "vitest"

// Guards the staff cross-tenant write: POST /api/v1/staff must reject foreign
// serviceIds (a staff member can only be linked to services owned by the
// caller's business), and the ownership count-guard must run BEFORE any user/
// staff row is created. Mocks prisma + v1 auth — no DB.

const { prismaMock, txMock, withV1AuthMock } = vi.hoisted(() => {
  const txMock = {
    service: { count: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    staff: { create: vi.fn() },
    staffService: { createMany: vi.fn() },
  }
  const prismaMock = {
    location: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
  }
  return { prismaMock, txMock, withV1AuthMock: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { POST } from "@/app/api/v1/staff/route"

// Valid v4 UUIDs (correct version "4" + variant "8/9/a/b" nibbles — Zod 4's
// .uuid() enforces them).
const BIZ = "11111111-1111-4111-8111-111111111111"
const SVC_A = "22222222-2222-4222-8222-222222222222"
const SVC_B = "33333333-3333-4333-8333-333333333333"

function req(body: unknown) {
  return new Request("http://localhost/api/v1/staff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = (serviceIds?: string[]) => ({
  firstName: "Jamie",
  lastName: "Lee",
  email: "jamie@example.com",
  role: "Stylist",
  ...(serviceIds ? { serviceIds } : {}),
})

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ businessId: BIZ, role: "admin" })
  prismaMock.location.findFirst.mockResolvedValue({ id: "loc_1" })
  txMock.user.findUnique.mockResolvedValue(null)
  txMock.user.create.mockResolvedValue({ id: "user_1" })
  txMock.staff.create.mockResolvedValue({ id: "staff_1" })
  txMock.staffService.createMany.mockResolvedValue({ count: 0 })
})

describe("POST /api/v1/staff — tenant isolation", () => {
  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await POST(req(validBody()))
    expect(res.status).toBe(401)
  })

  it("403s for non-admin roles", async () => {
    withV1AuthMock.mockResolvedValue({ businessId: BIZ, role: "staff" })
    const res = await POST(req(validBody()))
    expect(res.status).toBe(403)
  })

  it("rejects serviceIds not owned by the caller's business (no rows written)", async () => {
    // Two requested, only one owned by this business → guard trips.
    txMock.service.count.mockResolvedValue(1)
    const res = await POST(req(validBody([SVC_A, SVC_B])))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/serviceIds/i)
    // The count guard is scoped to the caller's business...
    expect(txMock.service.count).toHaveBeenCalledWith({
      where: { id: { in: [SVC_A, SVC_B] }, businessId: BIZ },
    })
    // ...and nothing is created when it fails.
    expect(txMock.user.create).not.toHaveBeenCalled()
    expect(txMock.staff.create).not.toHaveBeenCalled()
    expect(txMock.staffService.createMany).not.toHaveBeenCalled()
  })

  it("runs the ownership guard BEFORE creating the user", async () => {
    txMock.service.count.mockResolvedValue(2)
    await POST(req(validBody([SVC_A, SVC_B])))
    const guardOrder = txMock.service.count.mock.invocationCallOrder[0]
    const userOrder = txMock.user.create.mock.invocationCallOrder[0]
    expect(guardOrder).toBeLessThan(userOrder)
  })

  it("creates staff + links services on the happy path (201)", async () => {
    txMock.service.count.mockResolvedValue(2)
    const res = await POST(req(validBody([SVC_A, SVC_B])))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toEqual({ id: "staff_1", userId: "user_1" })
    expect(txMock.staffService.createMany).toHaveBeenCalledWith({
      data: [
        { staffId: "staff_1", serviceId: SVC_A },
        { staffId: "staff_1", serviceId: SVC_B },
      ],
    })
  })
})
