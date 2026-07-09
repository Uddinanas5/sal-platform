import { describe, it, expect, vi, beforeEach } from "vitest"

// L-047 — the withV1Auth Bearer API-key path returned the key's stored
// {userId, businessId, role} without re-checking whether the key CREATOR is still
// an active member of the business. Unlike the OAuth + session paths (which call
// resolveBusinessRole), a suspended/removed user's un-revoked key kept full access.
// The key acts AS its creator, so it must now die when the creator loses live
// membership — while still honoring the key's OWN configured role.

const { prismaMock, resolveRoleMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    apiKey: { findUnique: vi.fn(), update: vi.fn() },
    oAuthAccessToken: { findUnique: vi.fn() },
    business: { findUnique: vi.fn() },
  },
  resolveRoleMock: vi.fn(),
  authMock: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({ resolveBusinessRole: resolveRoleMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))

import { withV1Auth } from "@/lib/api/auth"

// A staff-scoped key (role "staff") created by user u1 in business b1.
const KEY = { id: "k1", createdById: "u1", businessId: "b1", role: "staff", revokedAt: null, expiresAt: null }
const req = () => new Request("https://x/api/v1/clients", { headers: { authorization: "Bearer sal_deadbeef" } })

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.apiKey.findUnique.mockResolvedValue({ ...KEY })
  prismaMock.apiKey.update.mockResolvedValue({})
  prismaMock.business.findUnique.mockResolvedValue(null) // isBillingGated → false (not gated)
})

describe("withV1Auth API-key path — re-validates the key creator's live membership (L-047)", () => {
  it("REJECTS the key when the creator is suspended/removed (resolveBusinessRole → null)", async () => {
    resolveRoleMock.mockResolvedValue(null)

    const ctx = await withV1Auth(req())

    expect(ctx).toBeNull()
    expect(resolveRoleMock).toHaveBeenCalledWith("u1", "b1")
    // A rejected key is not a successful use → lastUsedAt must NOT be bumped.
    expect(prismaMock.apiKey.update).not.toHaveBeenCalled()
  })

  it("ACCEPTS the key for an active creator and PRESERVES the key's own configured role", async () => {
    // Creator's live role is admin, but the KEY is staff-scoped — the key's role wins.
    resolveRoleMock.mockResolvedValue("admin")

    const ctx = await withV1Auth(req())

    expect(ctx).toEqual({ userId: "u1", businessId: "b1", role: "staff" })
    expect(prismaMock.apiKey.update).toHaveBeenCalledTimes(1)
  })
})
