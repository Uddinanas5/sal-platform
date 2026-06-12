import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression guard for POST /api/v1/reviews/[id]/respond.
// A caller authenticated under business BIZ must NOT be able to post a response
// to a review owned by another tenant (FOREIGN_ID). The route enforces this by
// ALWAYS scoping the prisma where-clause to ctx.businessId, so a foreign row is
// structurally unreachable: review.update against a BIZ-scoped where targeting a
// foreign id matches nothing → Prisma P2025 → the route's catch maps it to a 404
// NOT_FOUND. These tests assert the 404 response AND that the write carried
// businessId: BIZ. Mocks prisma + v1 auth — no DB. hasRole is a real pure
// function (not mocked); we drive the admin gate via ctx.role.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    review: { update: vi.fn() },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { POST } from "@/app/api/v1/reviews/[id]/respond/route"

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

function reqRespond(id: string, body: unknown = { response: "Thanks for the review!" }) {
  return new Request(`http://localhost/api/v1/reviews/${id}/respond`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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

describe("POST /api/v1/reviews/[id]/respond — cross-tenant IDOR", () => {
  it("returns 404 for a foreign-owned id and scopes the update to BIZ", async () => {
    // update() against a BIZ-scoped where targeting a foreign id finds nothing → P2025.
    prismaMock.review.update.mockRejectedValue(p2025())

    const res = await POST(reqRespond(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    // The single write must have carried businessId: BIZ — a foreign row is
    // structurally unreachable, so the attacker can never touch it.
    expect(prismaMock.review.update).toHaveBeenCalledTimes(1)
    expectScopedWhere(prismaMock.review.update.mock.calls[0][0], FOREIGN_ID)
  })

  it("scopes the response write under the caller's own review (happy path stays in-tenant)", async () => {
    const OWN_ID = "22222222-2222-4222-8222-222222222222"
    prismaMock.review.update.mockResolvedValue({ id: OWN_ID, businessId: BIZ })

    const res = await POST(reqRespond(OWN_ID), ctxArg(OWN_ID))
    expect(res.status).toBe(200)

    expect(prismaMock.review.update).toHaveBeenCalledTimes(1)
    expectScopedWhere(prismaMock.review.update.mock.calls[0][0], OWN_ID)
  })

  it("401s when unauthenticated and never touches the DB", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await POST(reqRespond(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHORIZED")
    expect(prismaMock.review.update).not.toHaveBeenCalled()
  })

  it("403s for the staff role (responding requires admin)", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await POST(reqRespond(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("FORBIDDEN")
    expect(prismaMock.review.update).not.toHaveBeenCalled()
  })
})
