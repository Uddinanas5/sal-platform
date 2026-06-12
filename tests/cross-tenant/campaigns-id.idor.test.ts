import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression guard for PATCH/DELETE /api/v1/marketing/campaigns/[id].
// A caller authenticated under business BIZ must NOT be able to mutate or delete a
// campaign owned by another tenant (FOREIGN_ID). The route enforces this by ALWAYS
// scoping the prisma where-clause to ctx.businessId, so a foreign row is structurally
// unreachable (update/delete -> P2025 -> caught -> NOT_FOUND). These tests assert both
// the 404 response AND that every prisma write carried businessId: BIZ. They also lock
// the 401 (unauthenticated) and 403 (staff role) gates. Mocks prisma + v1 auth — no DB.
// hasRole is a real pure function (not mocked); we drive role via ctx.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    campaign: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { PATCH, DELETE } from "@/app/api/v1/marketing/campaigns/[id]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"

// A Prisma "record not found" error — what update()/delete() throws when the
// where-clause (scoped to BIZ) matches no row, i.e. when targeting a foreign id.
function p2025(): Error {
  const e = new Error("Record to update not found.") as Error & { code: string }
  e.code = "P2025"
  return e
}

// Params arg for an [id] route: 2nd handler arg is { params: Promise<{ id }> }.
const ctxArg = (id: string) =>
  ({ params: Promise.resolve({ id }) }) as never

function reqPatch(id: string, body: unknown) {
  return new Request(`http://localhost/api/v1/marketing/campaigns/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
function reqDelete(id: string) {
  return new Request(`http://localhost/api/v1/marketing/campaigns/${id}`, {
    method: "DELETE",
  })
}

// Asserts a recorded mock call's where-clause is scoped to BIZ and targets the
// requested id — never a bare { id } that would leak across tenants.
function expectScopedWhere(call: unknown, id: string) {
  const where = (call as { where: { id: string; businessId: string } }).where
  expect(where.businessId).toBe(BIZ)
  expect(where.id).toBe(id)
}

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
})

describe("PATCH /api/v1/marketing/campaigns/[id] — cross-tenant IDOR", () => {
  it("returns 404 for a foreign-owned id and scopes the update to BIZ", async () => {
    // update() against a BIZ-scoped where targeting a foreign id finds nothing → P2025 → caught → NOT_FOUND.
    prismaMock.campaign.update.mockRejectedValue(p2025())

    const res = await PATCH(reqPatch(FOREIGN_ID, { name: "Hijack" }), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.campaign.update).toHaveBeenCalledTimes(1)
    const call = prismaMock.campaign.update.mock.calls[0][0] as unknown
    expectScopedWhere(call, FOREIGN_ID)
    expect(prismaMock.campaign.delete).not.toHaveBeenCalled()
  })

  it("401s when unauthenticated and never touches prisma", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await PATCH(reqPatch(FOREIGN_ID, { name: "x" }), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHORIZED")
    expect(prismaMock.campaign.update).not.toHaveBeenCalled()
  })

  it("403s for the staff role (write requires admin)", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await PATCH(reqPatch(FOREIGN_ID, { name: "x" }), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("FORBIDDEN")
    expect(prismaMock.campaign.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/v1/marketing/campaigns/[id] — cross-tenant IDOR", () => {
  it("returns 404 for a foreign-owned id and scopes the delete to BIZ", async () => {
    prismaMock.campaign.delete.mockRejectedValue(p2025())

    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.campaign.delete).toHaveBeenCalledTimes(1)
    const call = prismaMock.campaign.delete.mock.calls[0][0] as unknown
    expectScopedWhere(call, FOREIGN_ID)
    expect(prismaMock.campaign.update).not.toHaveBeenCalled()
  })

  it("401s when unauthenticated and never touches prisma", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHORIZED")
    expect(prismaMock.campaign.delete).not.toHaveBeenCalled()
  })

  it("403s for the staff role (delete requires admin)", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("FORBIDDEN")
    expect(prismaMock.campaign.delete).not.toHaveBeenCalled()
  })
})
