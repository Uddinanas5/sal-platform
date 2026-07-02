import { describe, it, expect, beforeEach, vi } from "vitest"

// P2-7/P2-8/P2-10 — onboarding hardening:
//  • duplicate service names don't crash Finish (dedupe + skipDuplicates)
//  • a reversed working-hours range (close <= open) is rejected on an open day
//  • services are only inserted once (idempotent-friendly)

const { prismaMock, authMock } = vi.hoisted(() => {
  const prismaMock = {
    business: { findFirst: vi.fn() },
    serviceCategory: { findFirst: vi.fn(), create: vi.fn() },
    service: { createMany: vi.fn() },
    businessHours: { deleteMany: vi.fn(), createMany: vi.fn() },
    location: {},
    $transaction: vi.fn(),
  }
  return { prismaMock, authMock: vi.fn() }
})
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { addOnboardingServices, saveWorkingHours } from "@/lib/actions/onboarding"

const BIZ = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: "owner-1" } })
  prismaMock.business.findFirst.mockResolvedValue({ id: BIZ, locations: [{ id: "loc-1" }] })
  prismaMock.serviceCategory.findFirst.mockResolvedValue({ id: "cat-1" })
  prismaMock.service.createMany.mockResolvedValue({ count: 1 })
  prismaMock.$transaction.mockResolvedValue([])
})

describe("addOnboardingServices — duplicate names", () => {
  it("de-dupes same-named entries and calls createMany once with skipDuplicates", async () => {
    const res = await addOnboardingServices({
      businessId: BIZ,
      services: [
        { name: "Haircut", durationMinutes: 30, price: 35 },
        { name: "haircut", durationMinutes: 60, price: 60 }, // dup (case-insensitive)
        { name: "Beard", durationMinutes: 20, price: 20 },
      ],
    })
    expect(res.success).toBe(true)
    expect(prismaMock.service.createMany).toHaveBeenCalledTimes(1)
    const arg = prismaMock.service.createMany.mock.calls[0][0]
    expect(arg.skipDuplicates).toBe(true)
    // "Haircut" + "Beard" — the duplicate "haircut" was dropped.
    expect(arg.data.map((s: { name: string }) => s.name)).toEqual(["Haircut", "Beard"])
  })
})

describe("saveWorkingHours — reversed range", () => {
  it("rejects an open day whose close <= open (does not write)", async () => {
    const res = await saveWorkingHours({
      businessId: BIZ,
      hours: [{ dayOfWeek: 1, isClosed: false, openTime: "17:00", closeTime: "09:00" }],
    })
    expect(res.success).toBe(false)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("accepts a valid range and writes in one transaction", async () => {
    const res = await saveWorkingHours({
      businessId: BIZ,
      hours: [{ dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" }],
    })
    expect(res.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })
})
