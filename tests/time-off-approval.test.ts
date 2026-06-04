import { describe, it, expect, beforeEach, vi } from "vitest"

// Guards the P0 time-off approval flow: requested time off stays "pending" and
// never blocks the calendar until an admin approves it. The availability engine
// (availability.ts) only honors status === "approved" rows, so the only safe
// way to block the calendar is to flip the REAL StaffTimeOff row to "approved".
//
// These tests prove, over a mock Prisma + mock auth-utils (no DB):
//   - approveTimeOff sets status === "approved" on the real row
//   - rejectTimeOff sets status === "rejected"
//   - both run requireMinRole("admin") (no admin → no write)
//   - the row is loaded scoped to the caller's businessId (tenant isolation):
//     a request whose staff is in another business is "not found" and untouched.

const { prismaMock, requireMinRoleMock, getBusinessContextMock, revalidatePathMock } =
  vi.hoisted(() => {
    const prismaMock = {
      staffTimeOff: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    }
    return {
      prismaMock,
      requireMinRoleMock: vi.fn(),
      getBusinessContextMock: vi.fn(),
      revalidatePathMock: vi.fn(),
    }
  })

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({
  requireMinRole: requireMinRoleMock,
  getBusinessContext: getBusinessContextMock,
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

import { approveTimeOff, rejectTimeOff } from "@/lib/actions/staff"

// Valid v4 UUIDs (version "4" + variant "8/9/a/b" nibbles — Zod's .uuid()).
const BIZ = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const TIME_OFF = "33333333-3333-4333-8333-333333333333"
const STAFF = "44444444-4444-4444-8444-444444444444"

beforeEach(() => {
  vi.clearAllMocks()
  requireMinRoleMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
  prismaMock.staffTimeOff.findFirst.mockResolvedValue({
    id: TIME_OFF,
    staffId: STAFF,
    status: "pending",
  })
  prismaMock.staffTimeOff.update.mockResolvedValue({ id: TIME_OFF, status: "approved" })
})

describe("approveTimeOff — flips the real row to approved", () => {
  it("sets status to approved so the availability engine blocks those slots", async () => {
    const res = await approveTimeOff(TIME_OFF)

    expect(res.success).toBe(true)
    expect(prismaMock.staffTimeOff.update).toHaveBeenCalledTimes(1)
    const updateArg = prismaMock.staffTimeOff.update.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: TIME_OFF })
    expect(updateArg.data.status).toBe("approved")
    expect(updateArg.data.approvedBy).toBe(USER)
    expect(updateArg.data.approvedAt).toBeInstanceOf(Date)
  })

  it("loads the row scoped to the caller's businessId (tenant isolation)", async () => {
    await approveTimeOff(TIME_OFF)
    const whereArg = prismaMock.staffTimeOff.findFirst.mock.calls[0][0].where
    expect(whereArg.id).toBe(TIME_OFF)
    expect(whereArg.staff).toEqual({ primaryLocation: { businessId: BIZ } })
  })

  it("revalidates the calendar so the new block shows up", async () => {
    await approveTimeOff(TIME_OFF)
    expect(revalidatePathMock).toHaveBeenCalledWith("/calendar")
  })

  it("requires admin — no write when requireMinRole rejects", async () => {
    requireMinRoleMock.mockRejectedValue(
      new Error("Insufficient permissions: requires admin role")
    )
    const res = await approveTimeOff(TIME_OFF)
    expect(res.success).toBe(false)
    expect(prismaMock.staffTimeOff.update).not.toHaveBeenCalled()
  })

  it("does not write a row owned by another business (not found, untouched)", async () => {
    // findFirst is scoped by businessId, so a foreign row resolves to null.
    prismaMock.staffTimeOff.findFirst.mockResolvedValue(null)
    const res = await approveTimeOff(TIME_OFF)
    expect(res.success).toBe(false)
    expect(prismaMock.staffTimeOff.update).not.toHaveBeenCalled()
  })

  it("rejects an invalid id without touching the DB", async () => {
    const res = await approveTimeOff("not-a-uuid")
    expect(res.success).toBe(false)
    expect(prismaMock.staffTimeOff.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.staffTimeOff.update).not.toHaveBeenCalled()
  })
})

describe("rejectTimeOff — flips the real row to rejected", () => {
  it("sets status to rejected so the calendar stays open", async () => {
    const res = await rejectTimeOff(TIME_OFF)
    expect(res.success).toBe(true)
    const updateArg = prismaMock.staffTimeOff.update.mock.calls[0][0]
    expect(updateArg.data.status).toBe("rejected")
  })
})
