import { describe, it, expect, beforeEach, vi } from "vitest"

// SETTINGS AUTHZ (P1-1, P1-2, P1-10) —
//  • Sensitive settings getters (payment, notification) and getBundles must
//    authenticate and refuse a caller-supplied businessId that isn't the
//    session's own (no cross-tenant read).
//  • Settings write actions must require admin role (a staff user is denied and
//    no DB write happens).

const { prismaMock, getBusinessContextMock, requireMinRoleMock } = vi.hoisted(() => {
  const prismaMock = {
    business: { findUnique: vi.fn(), update: vi.fn() },
    serviceBundle: { findMany: vi.fn() },
  }
  return { prismaMock, getBusinessContextMock: vi.fn(), requireMinRoleMock: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({
  getBusinessContext: getBusinessContextMock,
  requireMinRole: requireMinRoleMock,
}))

import { getPaymentSettings, getNotificationSettings, updatePaymentSettings } from "@/lib/actions/settings"
import { updateBookingSettings } from "@/lib/actions/booking-settings"
import { getBundles } from "@/lib/actions/bundles"

const OWN = "11111111-1111-4111-8111-111111111111"
const OTHER = "99999999-9999-4999-8999-999999999999"

beforeEach(() => {
  vi.clearAllMocks()
  getBusinessContextMock.mockResolvedValue({ userId: "u1", businessId: OWN, role: "admin" })
  requireMinRoleMock.mockResolvedValue({ userId: "u1", businessId: OWN, role: "admin" })
  prismaMock.business.findUnique.mockResolvedValue({ settings: {} })
  prismaMock.serviceBundle.findMany.mockResolvedValue([])
})

describe("sensitive getters refuse cross-tenant businessId", () => {
  it("getPaymentSettings throws Forbidden for a foreign businessId", async () => {
    await expect(getPaymentSettings(OTHER)).rejects.toThrow("Forbidden")
    expect(prismaMock.business.findUnique).not.toHaveBeenCalled()
  })
  it("getNotificationSettings throws Forbidden for a foreign businessId", async () => {
    await expect(getNotificationSettings(OTHER)).rejects.toThrow("Forbidden")
  })
  it("getBundles throws Forbidden for a foreign businessId", async () => {
    await expect(getBundles(OTHER)).rejects.toThrow("Forbidden")
    expect(prismaMock.serviceBundle.findMany).not.toHaveBeenCalled()
  })
  it("getPaymentSettings scopes to the session business when id matches", async () => {
    await getPaymentSettings(OWN)
    expect(prismaMock.business.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OWN } })
    )
  })
})

describe("settings writes require admin role", () => {
  it("updatePaymentSettings denied for staff (requireMinRole throws) — no DB write", async () => {
    requireMinRoleMock.mockRejectedValue(new Error("Insufficient permissions: requires admin role"))
    const res = await updatePaymentSettings({} as never)
    expect(res.success).toBe(false)
    expect(prismaMock.business.update).not.toHaveBeenCalled()
  })
  it("updateBookingSettings denied for staff — no DB write", async () => {
    requireMinRoleMock.mockRejectedValue(new Error("Insufficient permissions: requires admin role"))
    const res = await updateBookingSettings({} as never)
    expect(res.success).toBe(false)
    expect(prismaMock.business.update).not.toHaveBeenCalled()
  })
  it("updatePaymentSettings uses requireMinRole('admin'), not plain context", async () => {
    await updatePaymentSettings({} as never)
    expect(requireMinRoleMock).toHaveBeenCalledWith("admin")
  })
})
