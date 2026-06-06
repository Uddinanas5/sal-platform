import { describe, it, expect, beforeEach, vi } from "vitest"

// Backs the P0 "stop lying" fix for the client profile Overview tab: the Notes
// textarea and Tags editor used to show a success toast but only mutate local
// React state, silently losing the data on refresh. They now call the real
// updateClient server action, which persists `notes` and `tags` on the existing
// Client row.
//
// These tests prove, over a mock Prisma + mock auth-utils (no DB):
//   - updateClient writes the new `notes` value to the Client row
//   - updateClient writes the full `tags` array to the Client row
//   - the write is scoped to the caller's businessId (tenant isolation): the
//     prisma.client.update where-clause always carries { id, businessId }, so a
//     client owned by another business can never be updated.

const { prismaMock, getBusinessContextMock, revalidatePathMock } = vi.hoisted(() => {
  const prismaMock = {
    client: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  }
  return {
    prismaMock,
    getBusinessContextMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: getBusinessContextMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

import { updateClient } from "@/lib/actions/clients"

// Valid v4 UUIDs (version "4" + variant "8/9/a/b" nibbles — Zod's .uuid()).
const BIZ = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const CLIENT = "33333333-3333-4333-8333-333333333333"

beforeEach(() => {
  vi.clearAllMocks()
  getBusinessContextMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "admin" })
  prismaMock.client.update.mockResolvedValue({ id: CLIENT })
})

describe("updateClient — notes & tags persistence (client profile Overview tab)", () => {
  it("persists the notes value on the Client row scoped to the business", async () => {
    const result = await updateClient(CLIENT, { notes: "Allergic to latex gloves" })

    expect(result.success).toBe(true)
    expect(prismaMock.client.update).toHaveBeenCalledTimes(1)
    const arg = prismaMock.client.update.mock.calls[0][0]
    // Tenant isolation: the update is scoped to { id, businessId }.
    expect(arg.where).toEqual({ id: CLIENT, businessId: BIZ })
    expect(arg.data.notes).toBe("Allergic to latex gloves")
  })

  it("persists the full tags array on the Client row", async () => {
    const tags = ["VIP", "Color Specialist", "Referral"]
    const result = await updateClient(CLIENT, { tags })

    expect(result.success).toBe(true)
    const arg = prismaMock.client.update.mock.calls[0][0]
    expect(arg.where).toEqual({ id: CLIENT, businessId: BIZ })
    expect(arg.data.tags).toEqual(tags)
  })

  it("never updates a client outside the caller's business (where-clause carries businessId)", async () => {
    await updateClient(CLIENT, { tags: ["X"] })

    // Even if a foreign client id were supplied, the businessId in the where
    // clause means Prisma cannot match a row in another tenant.
    const arg = prismaMock.client.update.mock.calls[0][0]
    expect(arg.where.businessId).toBe(BIZ)
  })

  it("rejects an invalid (non-UUID) client id before any write", async () => {
    const result = await updateClient("not-a-uuid", { notes: "x" })

    expect(result.success).toBe(false)
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })
})
