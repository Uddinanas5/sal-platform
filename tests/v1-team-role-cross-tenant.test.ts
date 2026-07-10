import { describe, it, expect, beforeEach, vi } from "vitest"

// Auth audit P1: PATCH /api/v1/team/[userId] rewrote the GLOBAL User.role with no
// cross-tenant guard, so Tenant A's owner could silently make a user who is ALSO
// staff at Tenant B an admin there. The route now runs belongsToAnotherBusiness
// before the write. Drives the real handler over mocked v1-auth + prisma.

const { withV1Auth, staffFindFirst, businessFindFirst, userUpdate } = vi.hoisted(() => ({
  withV1Auth: vi.fn(),
  staffFindFirst: vi.fn(),
  businessFindFirst: vi.fn(),
  userUpdate: vi.fn(),
}))

vi.mock("@/lib/api/auth", () => ({ withV1Auth: (...a: unknown[]) => withV1Auth(...a) }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    staff: { findFirst: (...a: unknown[]) => staffFindFirst(...a) },
    business: { findFirst: (...a: unknown[]) => businessFindFirst(...a) },
    user: { update: (...a: unknown[]) => userUpdate(...a) },
  },
}))

import { PATCH } from "@/app/api/v1/team/[userId]/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const TARGET = "22222222-2222-4222-8222-222222222222"

function patch(userId: string, newRole = "admin") {
  const req = new Request(`http://localhost/api/v1/team/${userId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newRole }),
  })
  return PATCH(req, { params: Promise.resolve({ userId }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  withV1Auth.mockResolvedValue({ businessId: BIZ, userId: "owner1", role: "owner" })
  // 1st staff.findFirst = the target's profile in THIS business (a plain staff).
  staffFindFirst.mockResolvedValueOnce({ id: "sp", user: { role: "staff" } })
  businessFindFirst.mockResolvedValue(null) // target owns no other business
  userUpdate.mockResolvedValue({ id: TARGET, role: "admin" })
})

describe("PATCH /api/v1/team/[userId] — cross-tenant role-change guard (auth audit P1)", () => {
  it("REFUSES the role change when the target is also staff at another business (no write)", async () => {
    // 2nd staff.findFirst (inside the guard) = a staff profile at ANOTHER business.
    staffFindFirst.mockResolvedValueOnce({ id: "s2" })

    const res = await patch(TARGET)

    expect(res.status).toBe(400)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it("ALLOWS the role change for a user who belongs only to this business", async () => {
    staffFindFirst.mockResolvedValueOnce(null) // no staff profile elsewhere

    const res = await patch(TARGET)

    expect(res.status).toBe(200)
    expect(userUpdate).toHaveBeenCalledTimes(1)
    expect(userUpdate.mock.calls[0]![0]).toMatchObject({ where: { id: TARGET }, data: { role: "admin" } })
  })
})
