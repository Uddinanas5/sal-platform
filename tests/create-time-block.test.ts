import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the one-off "block 2-3pm today" feature over a mock Prisma + mock
// auth-utils (no DB). A one-off block reuses the EXISTING StaffTimeOff model:
// it is written as a partial-day row (startTime/endTime set) with status
// "approved" so the availability engine blocks the slot immediately — no
// migration, no schema change, no new tender.
//
// These tests assert:
//   - createTimeBlock writes an APPROVED, partial-day StaffTimeOff row
//   - the staff is validated against the caller's businessId (tenant isolation):
//     a staffId in another business is "not found" and nothing is written
//   - a staff-role user may only block their OWN calendar
//   - input is validated (bad times / empty reason never touch the DB)

const { prismaMock, getBusinessContextMock, revalidatePathMock } = vi.hoisted(() => {
  const prismaMock = {
    staff: {
      findFirst: vi.fn(),
    },
    staffTimeOff: {
      create: vi.fn(),
    },
  }
  return {
    prismaMock,
    getBusinessContextMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({
  getBusinessContext: getBusinessContextMock,
  // requireMinRole is referenced elsewhere in staff.ts; stub it so the module loads.
  requireMinRole: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

import { createTimeBlock } from "@/lib/actions/staff"

// Valid v4 UUIDs (version "4" + variant "8/9/a/b" nibbles — Zod's .uuid()).
const BIZ = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const STAFF = "44444444-4444-4444-8444-444444444444"
const STAFF_USER = "55555555-5555-4555-8555-555555555555"

const validInput = {
  staffId: STAFF,
  date: "2026-06-04",
  startTime: "14:00",
  endTime: "15:00",
  reason: "Lunch",
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: an admin in BIZ; the staff belongs to BIZ.
  getBusinessContextMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
  prismaMock.staff.findFirst.mockResolvedValue({ id: STAFF, userId: STAFF_USER })
  prismaMock.staffTimeOff.create.mockResolvedValue({ id: "created" })
})

describe("createTimeBlock — writes an APPROVED partial-day StaffTimeOff", () => {
  it("creates an approved, partial-day block so the availability engine blocks the slot", async () => {
    const res = await createTimeBlock(validInput)

    expect(res.success).toBe(true)
    expect(prismaMock.staffTimeOff.create).toHaveBeenCalledTimes(1)
    const data = prismaMock.staffTimeOff.create.mock.calls[0][0].data

    expect(data.staffId).toBe(STAFF)
    // Pre-approved: the engine only honors approved rows.
    expect(data.status).toBe("approved")
    expect(data.approvedBy).toBe(USER)
    expect(data.approvedAt).toBeInstanceOf(Date)
    // Existing TimeOffType (no migration / new enum value).
    expect(data.type).toBe("personal")
    // Reason is persisted on the row.
    expect(data.notes).toBe("Lunch")
    // Single-day block: startDate === endDate.
    expect(data.startDate).toBeInstanceOf(Date)
    expect(data.endDate).toBeInstanceOf(Date)
    expect((data.startDate as Date).getTime()).toBe((data.endDate as Date).getTime())
    // Partial-day: startTime/endTime are set so it blocks a range, not the day.
    expect(data.startTime).toBeInstanceOf(Date)
    expect(data.endTime).toBeInstanceOf(Date)
    expect((data.startTime as Date).getHours()).toBe(14)
    expect((data.endTime as Date).getHours()).toBe(15)
  })

  it("validates the staff against the caller's businessId (tenant isolation)", async () => {
    await createTimeBlock(validInput)
    const where = prismaMock.staff.findFirst.mock.calls[0][0].where
    expect(where.id).toBe(STAFF)
    expect(where.primaryLocation).toEqual({ businessId: BIZ })
  })

  it("revalidates the calendar so the block shows up as unavailable", async () => {
    await createTimeBlock(validInput)
    expect(revalidatePathMock).toHaveBeenCalledWith("/calendar")
  })
})

describe("createTimeBlock — multi-tenant isolation & permissions", () => {
  it("does not write a block for a staff in another business (not found, untouched)", async () => {
    // findFirst is scoped by businessId, so a foreign staffId resolves to null.
    prismaMock.staff.findFirst.mockResolvedValue(null)
    const res = await createTimeBlock(validInput)
    expect(res.success).toBe(false)
    expect(prismaMock.staffTimeOff.create).not.toHaveBeenCalled()
  })

  it("a staff-role user can only block their OWN calendar", async () => {
    // Caller is staff-role but NOT the staff member being blocked.
    getBusinessContextMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "staff" })
    prismaMock.staff.findFirst.mockResolvedValue({ id: STAFF, userId: STAFF_USER })
    const res = await createTimeBlock(validInput)
    expect(res.success).toBe(false)
    expect(prismaMock.staffTimeOff.create).not.toHaveBeenCalled()
  })

  it("a staff-role user CAN block their own calendar", async () => {
    getBusinessContextMock.mockResolvedValue({ businessId: BIZ, userId: STAFF_USER, role: "staff" })
    prismaMock.staff.findFirst.mockResolvedValue({ id: STAFF, userId: STAFF_USER })
    const res = await createTimeBlock(validInput)
    expect(res.success).toBe(true)
    expect(prismaMock.staffTimeOff.create).toHaveBeenCalledTimes(1)
  })
})

describe("createTimeBlock — input validation never touches the DB", () => {
  it("rejects an invalid staffId", async () => {
    const res = await createTimeBlock({ ...validInput, staffId: "not-a-uuid" })
    expect(res.success).toBe(false)
    expect(prismaMock.staff.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.staffTimeOff.create).not.toHaveBeenCalled()
  })

  it("rejects when end time is not after start time", async () => {
    const res = await createTimeBlock({ ...validInput, startTime: "15:00", endTime: "14:00" })
    expect(res.success).toBe(false)
    expect(prismaMock.staffTimeOff.create).not.toHaveBeenCalled()
  })

  it("rejects an empty reason", async () => {
    const res = await createTimeBlock({ ...validInput, reason: "   " })
    expect(res.success).toBe(false)
    expect(prismaMock.staffTimeOff.create).not.toHaveBeenCalled()
  })

  it("rejects a malformed time", async () => {
    const res = await createTimeBlock({ ...validInput, startTime: "9am" })
    expect(res.success).toBe(false)
    expect(prismaMock.staffTimeOff.create).not.toHaveBeenCalled()
  })
})
