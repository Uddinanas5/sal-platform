import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression guard for GET/PATCH/DELETE /api/v1/services/[id].
// A caller authenticated under business BIZ must NOT be able to read, mutate, or
// soft-delete a service owned by another tenant (FOREIGN_ID). The route enforces
// this by ALWAYS scoping the prisma where-clause to ctx.businessId, so a foreign
// row is structurally unreachable (findUnique -> null -> 404; update -> P2025 ->
// 404). These tests assert both the 404 response AND that every prisma read/write
// carried businessId: BIZ. Mocks prisma + v1 auth — no DB. hasRole is a real pure
// function (not mocked); we drive role via ctx.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    service: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { GET, PATCH, DELETE } from "@/app/api/v1/services/[id]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"

// A Prisma "record to update not found" error — what update() throws when the
// where-clause (scoped to BIZ) matches no row, i.e. when targeting a foreign id.
function p2025(): Error {
  const e = new Error("Record to update not found.") as Error & { code: string }
  e.code = "P2025"
  return e
}

// Params arg for an [id] route: 2nd handler arg is { params: Promise<{ id }> }.
const ctxArg = (id: string) =>
  ({ params: Promise.resolve({ id }) }) as never

function reqGet(id: string) {
  return new Request(`http://localhost/api/v1/services/${id}`, { method: "GET" })
}
function reqPatch(id: string, body: unknown, action?: string) {
  const url = `http://localhost/api/v1/services/${id}${action ? `?action=${action}` : ""}`
  return new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
function reqDelete(id: string) {
  return new Request(`http://localhost/api/v1/services/${id}`, { method: "DELETE" })
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

describe("GET /api/v1/services/[id] — cross-tenant IDOR", () => {
  it("returns 404 for a foreign-owned id and scopes the lookup to BIZ", async () => {
    // Foreign row is invisible under BIZ: findUnique resolves null.
    prismaMock.service.findUnique.mockResolvedValue(null)

    const res = await GET(reqGet(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.service.findUnique).toHaveBeenCalledTimes(1)
    expectScopedWhere(prismaMock.service.findUnique.mock.calls[0][0], FOREIGN_ID)
    // deletedAt:null also enforced so soft-deleted rows stay invisible.
    const where = (prismaMock.service.findUnique.mock.calls[0][0] as { where: { deletedAt: unknown } }).where
    expect(where.deletedAt).toBeNull()
  })

  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await GET(reqGet(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    expect(prismaMock.service.findUnique).not.toHaveBeenCalled()
  })
})

describe("PATCH /api/v1/services/[id] — cross-tenant IDOR", () => {
  it("returns 404 for a foreign-owned id and scopes the update to BIZ (default action)", async () => {
    // update() against a BIZ-scoped where targeting a foreign id finds nothing → P2025.
    prismaMock.service.update.mockRejectedValue(p2025())

    const res = await PATCH(reqPatch(FOREIGN_ID, { name: "Hijack" }), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.service.update).toHaveBeenCalledTimes(1)
    expectScopedWhere(prismaMock.service.update.mock.calls[0][0], FOREIGN_ID)
  })

  it("returns 404 for a foreign-owned id on the toggle action and scopes both reads/writes to BIZ", async () => {
    // toggle: findUnique (scoped) → null → NOT_FOUND, never reaching update.
    prismaMock.service.findUnique.mockResolvedValue(null)

    const res = await PATCH(reqPatch(FOREIGN_ID, {}, "toggle"), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.service.findUnique).toHaveBeenCalledTimes(1)
    expectScopedWhere(prismaMock.service.findUnique.mock.calls[0][0], FOREIGN_ID)
    expect(prismaMock.service.update).not.toHaveBeenCalled()
  })

  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await PATCH(reqPatch(FOREIGN_ID, { name: "x" }), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    expect(prismaMock.service.update).not.toHaveBeenCalled()
  })

  it("403s for the staff role (write requires admin)", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await PATCH(reqPatch(FOREIGN_ID, { name: "x" }), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("FORBIDDEN")
    expect(prismaMock.service.update).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/v1/services/[id] — cross-tenant IDOR", () => {
  it("returns 404 for a foreign-owned id and scopes the soft-delete to BIZ", async () => {
    prismaMock.service.update.mockRejectedValue(p2025())

    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    expect(prismaMock.service.update).toHaveBeenCalledTimes(1)
    expectScopedWhere(prismaMock.service.update.mock.calls[0][0], FOREIGN_ID)
  })

  it("401s when unauthenticated", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    expect(prismaMock.service.update).not.toHaveBeenCalled()
  })

  it("403s for the staff role (delete requires admin)", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("FORBIDDEN")
    expect(prismaMock.service.update).not.toHaveBeenCalled()
  })
})
