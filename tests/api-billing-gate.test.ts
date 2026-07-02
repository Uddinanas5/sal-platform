import { describe, it, expect, beforeEach, vi } from "vitest"

// P2-15 — the programmatic API honors the billing gate: a cancelled (once-
// subscribed) salon is denied via withV1Auth, exactly like the dashboard. A
// never-subscribed beta salon (safe default) is still allowed.

const { prismaMock, authMock } = vi.hoisted(() => {
  const prismaMock = {
    user: { findUnique: vi.fn() },
    business: { findFirst: vi.fn(), findUnique: vi.fn() },
    staff: { findFirst: vi.fn() },
    apiKey: { findUnique: vi.fn() },
    oAuthAccessToken: { findUnique: vi.fn() },
  }
  return { prismaMock, authMock: vi.fn() }
})
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))

import { withV1Auth } from "@/lib/api/auth"

const USER = "11111111-1111-4111-8111-111111111111"
const BIZ = "22222222-2222-4222-8222-222222222222"

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: USER, businessId: BIZ, role: "owner" } })
  // Active owner membership (passes resolveBusinessRole).
  prismaMock.user.findUnique.mockResolvedValue({ role: "owner", status: "active" })
  prismaMock.business.findFirst.mockResolvedValue({ id: BIZ })
  prismaMock.staff.findFirst.mockResolvedValue(null)
})

const req = () => new Request("https://x/api/v1/clients")

describe("withV1Auth billing gate", () => {
  it("denies a cancelled once-subscribed salon", async () => {
    prismaMock.business.findUnique.mockResolvedValue({
      subscriptionStatus: "cancelled",
      stripeSubscriptionId: "sub_1",
      billingExempt: false,
    })
    expect(await withV1Auth(req())).toBeNull()
  })

  it("allows a never-subscribed beta salon (safe default)", async () => {
    prismaMock.business.findUnique.mockResolvedValue({
      subscriptionStatus: "active",
      stripeSubscriptionId: null,
      billingExempt: false,
    })
    const ctx = await withV1Auth(req())
    expect(ctx).toEqual({ userId: USER, businessId: BIZ, role: "owner" })
  })

  it("allows a billing-exempt salon even if cancelled", async () => {
    prismaMock.business.findUnique.mockResolvedValue({
      subscriptionStatus: "cancelled",
      stripeSubscriptionId: "sub_1",
      billingExempt: true,
    })
    expect(await withV1Auth(req())).not.toBeNull()
  })
})
