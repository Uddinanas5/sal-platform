import { describe, it, expect, beforeEach, vi } from "vitest"

// Reactivating a cancelled/no_show appointment must re-check for conflicts — the
// slot may have been taken while it was free. Otherwise reactivation double-books.

const { prismaMock, ctxMock } = vi.hoisted(() => {
  const tx = {
    appointmentService: { findFirst: vi.fn() },
    appointment: { update: vi.fn() },
    $executeRaw: vi.fn(),
  }
  const prismaMock = {
    appointment: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    __tx: tx,
  }
  return { prismaMock, ctxMock: vi.fn() }
})
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: ctxMock, requireMinRole: ctxMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/db/advisory-lock", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return { ...actual, lockStaffSchedule: vi.fn() }
})

import { updateAppointmentStatus } from "@/lib/actions/appointments"

const BIZ = "biz-1"
const APPT = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
  ctxMock.mockResolvedValue({ businessId: BIZ, userId: "u1", role: "admin" })
})

describe("updateAppointmentStatus reactivation guard", () => {
  it("refuses reactivating a cancelled appointment onto a now-taken slot", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue({
      status: "cancelled",
      services: [{ staffId: "s1", startTime: new Date("2026-07-10T14:00:00Z"), endTime: new Date("2026-07-10T14:45:00Z") }],
    })
    // A conflicting appointment now occupies the slot.
    prismaMock.__tx.appointmentService.findFirst.mockResolvedValue({ id: "other" })

    const res = await updateAppointmentStatus(APPT, "confirmed")
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/no longer free/i)
    expect(prismaMock.__tx.appointment.update).not.toHaveBeenCalled()
  })

  it("allows reactivation when the slot is still free", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue({
      status: "no_show",
      services: [{ staffId: "s1", startTime: new Date("2026-07-10T14:00:00Z"), endTime: new Date("2026-07-10T14:45:00Z") }],
    })
    prismaMock.__tx.appointmentService.findFirst.mockResolvedValue(null)
    prismaMock.__tx.appointment.update.mockResolvedValue({ id: APPT, client: null, services: [], business: { timezone: "UTC" } })

    const res = await updateAppointmentStatus(APPT, "confirmed")
    expect(res.success).toBe(true)
    expect(prismaMock.__tx.appointment.update).toHaveBeenCalled()
  })

  it("does NOT run the conflict check for a normal forward transition (confirmed→completed)", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue({
      status: "confirmed",
      services: [{ staffId: "s1", startTime: new Date(), endTime: new Date() }],
    })
    prismaMock.appointment.update.mockResolvedValue({ id: APPT, client: null, services: [], business: { timezone: "UTC" } })

    const res = await updateAppointmentStatus(APPT, "completed")
    expect(res.success).toBe(true)
    // Non-reactivation path uses the plain (non-tx) update, no conflict scan.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.appointment.update).toHaveBeenCalled()
  })
})
