import { describe, it, expect, beforeEach, vi } from "vitest"

// MEMBERSHIP REVOCATION (P0-1) — access is re-validated against live DB state on
// every request, not trusted from the 7-day JWT. A removed staffer (Staff row
// soft-deleted) or a deactivated user must be DENIED immediately.
//
// Contract under test: getBusinessContext() / resolveBusinessRole()
// (src/lib/auth-utils.ts) and the session-cookie path of withV1Auth()
// (src/lib/api/auth.ts) both call resolveBusinessRole, which returns null when
// the user has no live owner/active-staff relationship with the business.

const { prismaMock, authMock } = vi.hoisted(() => {
  const prismaMock = {
    user: { findUnique: vi.fn() },
    business: { findFirst: vi.fn() },
    staff: { findFirst: vi.fn() },
    apiKey: { findUnique: vi.fn() },
    oAuthAccessToken: { findUnique: vi.fn() },
  }
  return { prismaMock, authMock: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))

import { getBusinessContext, resolveBusinessRole } from "@/lib/auth-utils"
import { withV1Auth } from "@/lib/api/auth"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const BIZ_ID = "22222222-2222-4222-8222-222222222222"

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: USER_ID, businessId: BIZ_ID, role: "admin" } })
})

describe("resolveBusinessRole — live membership check", () => {
  it("returns null for a removed staffer (no owned business, no active staff row)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "staff", status: "active" })
    prismaMock.business.findFirst.mockResolvedValue(null)
    prismaMock.staff.findFirst.mockResolvedValue(null) // soft-deleted → filtered out
    expect(await resolveBusinessRole(USER_ID, BIZ_ID)).toBeNull()
  })

  it("returns null for a deactivated user even if still owner", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "suspended" })
    prismaMock.business.findFirst.mockResolvedValue({ id: BIZ_ID })
    prismaMock.staff.findFirst.mockResolvedValue(null)
    expect(await resolveBusinessRole(USER_ID, BIZ_ID)).toBeNull()
  })

  it("returns fresh role for an active owner", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "active" })
    prismaMock.business.findFirst.mockResolvedValue({ id: BIZ_ID })
    prismaMock.staff.findFirst.mockResolvedValue(null)
    expect(await resolveBusinessRole(USER_ID, BIZ_ID)).toBe("owner")
  })

  it("honors the user's real role for active staff (no silent escalation)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "staff", status: "active" })
    prismaMock.business.findFirst.mockResolvedValue(null)
    prismaMock.staff.findFirst.mockResolvedValue({ id: "staff-1" })
    expect(await resolveBusinessRole(USER_ID, BIZ_ID)).toBe("staff")
  })
})

describe("getBusinessContext — denies revoked members despite a valid JWT", () => {
  it("throws when membership is revoked (removed staffer)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "staff", status: "active" })
    prismaMock.business.findFirst.mockResolvedValue(null)
    prismaMock.staff.findFirst.mockResolvedValue(null)
    await expect(getBusinessContext()).rejects.toThrow("No business context")
  })

  it("uses the FRESH role from DB, not the stale JWT claim", async () => {
    // JWT says admin, but DB says this user is now only staff.
    prismaMock.user.findUnique.mockResolvedValue({ role: "staff", status: "active" })
    prismaMock.business.findFirst.mockResolvedValue(null)
    prismaMock.staff.findFirst.mockResolvedValue({ id: "staff-1" })
    const ctx = await getBusinessContext()
    expect(ctx.role).toBe("staff")
  })
})

describe("withV1Auth — session cookie path re-validates membership", () => {
  it("returns null for a removed staffer's still-valid session cookie", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "staff", status: "active" })
    prismaMock.business.findFirst.mockResolvedValue(null)
    prismaMock.staff.findFirst.mockResolvedValue(null)
    const req = new Request("https://x/api/v1/clients") // no Authorization header → session path
    expect(await withV1Auth(req)).toBeNull()
  })

  it("returns context with fresh role for an active member", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "active" })
    prismaMock.business.findFirst.mockResolvedValue({ id: BIZ_ID })
    prismaMock.staff.findFirst.mockResolvedValue(null)
    const req = new Request("https://x/api/v1/clients")
    expect(await withV1Auth(req)).toEqual({ userId: USER_ID, businessId: BIZ_ID, role: "owner" })
  })
})
