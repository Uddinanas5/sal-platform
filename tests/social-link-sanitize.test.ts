import { describe, it, expect, beforeEach, vi } from "vitest"

// P2-16 — social links are rendered as raw hrefs on the PUBLIC booking page, so a
// dangerous scheme (javascript:, data:) must be rejected at save time. http(s)
// URLs and bare handles/domains stay allowed.

const { prismaMock, requireMinRoleMock } = vi.hoisted(() => {
  const business = { findUnique: vi.fn(), update: vi.fn() }
  const tx = { business, $executeRaw: vi.fn() }
  return {
    prismaMock: {
      business,
      // mergeBusinessSettings runs its work inside an interactive transaction.
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    },
    requireMinRoleMock: vi.fn(),
  }
})
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
// merge-settings imports Prisma types + lockBusiness ($executeRaw on tx) — stub the lock.
vi.mock("@/lib/db/advisory-lock", () => ({ lockBusiness: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({
  requireMinRole: requireMinRoleMock,
  getBusinessContext: vi.fn(),
}))

import { updateOnlinePresenceSettings } from "@/lib/actions/settings"

beforeEach(() => {
  vi.clearAllMocks()
  requireMinRoleMock.mockResolvedValue({ userId: "u1", businessId: "b1", role: "admin" })
  prismaMock.business.findUnique.mockResolvedValue({ settings: {} })
  prismaMock.business.update.mockResolvedValue({})
})

function base() {
  return { buttonColor: "#059669", buttonText: "Book", widgetSize: "medium" as const }
}

describe("social link scheme validation", () => {
  it("rejects a javascript: URL and does not write", async () => {
    const res = await updateOnlinePresenceSettings({
      ...base(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socialLinks: { instagram: "javascript:alert(1)", facebook: "", tiktok: "", website: "" } as any,
    })
    expect(res.success).toBe(false)
    expect(prismaMock.business.update).not.toHaveBeenCalled()
  })

  it("rejects a data: URL", async () => {
    const res = await updateOnlinePresenceSettings({
      ...base(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socialLinks: { instagram: "", facebook: "data:text/html,<script>", tiktok: "", website: "" } as any,
    })
    expect(res.success).toBe(false)
  })

  it("allows https URLs and bare handles", async () => {
    const res = await updateOnlinePresenceSettings({
      ...base(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socialLinks: { instagram: "@myshop", facebook: "https://fb.com/myshop", tiktok: "myshop.com", website: "" } as any,
    })
    expect(res.success).toBe(true)
    expect(prismaMock.business.update).toHaveBeenCalled()
  })
})
