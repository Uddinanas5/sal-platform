import { describe, it, expect, beforeEach, vi } from "vitest"

// Cross-tenant IDOR regression guard for DELETE /api/v1/team/invitations/[id]
// (revoke a staff invitation). A caller authenticated under business BIZ must
// NOT be able to revoke an invitation owned by another tenant.
//
// The route reads the row by bare id (findUnique({ where: { id } })) but then
// enforces ownership in application code: `invitation.businessId !== ctx.businessId`
// → 404 NOT_FOUND, returning BEFORE any write. The revoking update is ALSO
// scoped to businessId: ctx.businessId, so a foreign row is structurally
// unreachable from the write path. These tests assert the 404 for a foreign
// row, that the write never fires for a foreign row, AND that the revoke write
// (for an owned row) carries businessId: BIZ. Also covers 401 (unauth) and 403
// (staff — revoke requires admin). Mocks prisma + v1 auth — no DB. hasRole is a
// real pure function (not mocked); role is driven via ctx.

const { prismaMock, withV1AuthMock } = vi.hoisted(() => ({
  prismaMock: {
    staffInvitation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: withV1AuthMock }))

import { DELETE } from "@/app/api/v1/team/invitations/[id]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const FOREIGN_BIZ = "22222222-2222-4222-8222-222222222222"
const FOREIGN_ID = "99999999-9999-4999-8999-999999999999"

// Params arg for an [id] route: 2nd handler arg is { params: Promise<{ id }> }.
const ctxArg = (id: string) => ({ params: Promise.resolve({ id }) }) as never

function reqDelete(id: string) {
  return new Request(`http://localhost/api/v1/team/invitations/${id}`, {
    method: "DELETE",
  })
}

// A pending invitation row that BELONGS to BIZ (the happy/owned path).
const ownedInvitation = (id: string) => ({
  id,
  businessId: BIZ,
  acceptedAt: null,
  revokedAt: null,
})

// A pending invitation row that belongs to ANOTHER tenant. findUnique returns
// it (bare id lookup), but the route must reject it on the ownership check.
const foreignInvitation = (id: string) => ({
  id,
  businessId: FOREIGN_BIZ,
  acceptedAt: null,
  revokedAt: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "admin" })
})

describe("DELETE /api/v1/team/invitations/[id] — cross-tenant IDOR", () => {
  it("returns 404 for a foreign-owned invitation and never writes", async () => {
    // Row exists in the DB but belongs to FOREIGN_BIZ. The route's ownership
    // check (invitation.businessId !== ctx.businessId) must reject with 404.
    prismaMock.staffInvitation.findUnique.mockResolvedValue(foreignInvitation(FOREIGN_ID))

    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")

    // The revoke write must NOT fire for a foreign-owned row.
    expect(prismaMock.staffInvitation.update).not.toHaveBeenCalled()
  })

  it("returns 404 when the invitation does not exist at all", async () => {
    prismaMock.staffInvitation.findUnique.mockResolvedValue(null)

    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("NOT_FOUND")
    expect(prismaMock.staffInvitation.update).not.toHaveBeenCalled()
  })

  it("revokes an OWNED invitation and scopes the write to BIZ", async () => {
    // Owned, pending invitation → revoke proceeds. The write where-clause must
    // carry businessId: BIZ so a row outside the tenant is unreachable.
    prismaMock.staffInvitation.findUnique.mockResolvedValue(ownedInvitation(FOREIGN_ID))
    prismaMock.staffInvitation.update.mockResolvedValue({
      id: FOREIGN_ID,
      businessId: BIZ,
      revokedAt: new Date(),
    })

    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.revoked).toBe(true)

    expect(prismaMock.staffInvitation.update).toHaveBeenCalledTimes(1)
    const updateArg = prismaMock.staffInvitation.update.mock.calls[0][0] as unknown as {
      where: { id: string; businessId: string }
    }
    expect(updateArg.where.businessId).toBe(BIZ)
    expect(updateArg.where.businessId).not.toBe(FOREIGN_BIZ)
    expect(updateArg.where.id).toBe(FOREIGN_ID)
  })

  it("401s when unauthenticated and never reads or writes", async () => {
    withV1AuthMock.mockResolvedValue(null)
    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHORIZED")
    expect(prismaMock.staffInvitation.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.staffInvitation.update).not.toHaveBeenCalled()
  })

  it("403s for the staff role (revoke requires admin) and never reads or writes", async () => {
    withV1AuthMock.mockResolvedValue({ userId: "u1", businessId: BIZ, role: "staff" })
    const res = await DELETE(reqDelete(FOREIGN_ID), ctxArg(FOREIGN_ID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("FORBIDDEN")
    expect(prismaMock.staffInvitation.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.staffInvitation.update).not.toHaveBeenCalled()
  })
})
