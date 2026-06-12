import { describe, it, expect, beforeEach, vi } from "vitest"

// GROUP-OVERSELL — capacity integrity for addGroupParticipant (actions/recurring.ts).
//
// A group booking must never be filled past its maxParticipants. The seat-grant
// is a read-then-write that two staff can race (both read count = max-1, both
// insert => oversell). The fix takes a per-appointment advisory lock, RE-COUNTS
// groupParticipant UNDER that lock inside a $transaction, and throws GroupFullError
// (rolling back) when the live count is already >= maxParticipants — so the create
// never runs once the group is full.
//
// This suite proves the under-lock count gate, with no DB (mock-Prisma pattern
// copied from tests/group-a-tenant-authz.test.ts / checkout-product-line.test.ts).

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.mock factories are hoisted above imports, so every symbol
// they reference must come from vi.hoisted.
// ---------------------------------------------------------------------------
const {
  prismaMock,
  groupParticipantTxMock,
  getBusinessContextMock,
  lockAppointmentMock,
  assertClientOwnedMock,
} = vi.hoisted(() => {
  // The in-tx groupParticipant model the action re-counts then inserts against.
  const groupParticipantTxMock = {
    count: vi.fn(),
    create: vi.fn(),
  }
  const prismaMock = {
    appointment: { findUnique: vi.fn() },
    // $transaction runs the callback against a tx exposing $executeRaw (for the
    // advisory lock, which is itself mocked away) and the groupParticipant model
    // (count + create). Variadic so the call captures the second (options) arg.
    $transaction: vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (cb: (tx: unknown) => unknown, ..._rest: any[]) =>
        cb({ $executeRaw: vi.fn(), groupParticipant: groupParticipantTxMock }),
    ),
  }
  return {
    prismaMock,
    groupParticipantTxMock,
    getBusinessContextMock: vi.fn(),
    lockAppointmentMock: vi.fn(),
    assertClientOwnedMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({
  getBusinessContext: getBusinessContextMock,
  requireMinRole: vi.fn(),
}))
// Neutralize the raw advisory-lock SQL (no DB) but keep the real action logic.
// recurring.ts imports lockStaffSchedule + lockAppointment + isBookingContentionError,
// so provide all three for the module graph to resolve.
vi.mock("@/lib/db/advisory-lock", () => ({
  lockAppointment: lockAppointmentMock,
  lockStaffSchedule: vi.fn(),
  isBookingContentionError: vi.fn(() => false),
}))
// recurring.ts imports several ownership asserts at module load; provide them all.
vi.mock("@/lib/ownership", () => ({
  assertClientOwned: assertClientOwnedMock,
  assertClientsOwned: vi.fn(),
  assertStaffOwned: vi.fn(),
  generateBookingReference: vi.fn(() => "REF-TEST"),
}))

import { addGroupParticipant } from "@/lib/actions/recurring"

// Valid v4 UUIDs (version "4" + variant "8/9/a/b" nibbles — Zod's .uuid()).
const BIZ = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const APPT = "33333333-3333-4333-8333-333333333333"
const CLIENT = "44444444-4444-4444-8444-444444444444"

const MAX = 4

beforeEach(() => {
  vi.clearAllMocks()
  getBusinessContextMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
  lockAppointmentMock.mockResolvedValue(undefined)
  assertClientOwnedMock.mockResolvedValue(undefined)
  prismaMock.appointment.findUnique.mockResolvedValue({
    id: APPT,
    isGroupBooking: true,
    maxParticipants: MAX,
  })
  groupParticipantTxMock.create.mockResolvedValue({ id: "gp_1" })
})

describe("addGroupParticipant — cannot oversell past maxParticipants", () => {
  it("REJECTS when the under-lock count already equals maxParticipants (group full, no insert)", async () => {
    // Re-count under the advisory lock shows the group is already at capacity.
    groupParticipantTxMock.count.mockResolvedValue(MAX)

    const res = await addGroupParticipant(APPT, CLIENT)

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/full/i)
    // The seat was NOT granted — overselling is blocked.
    expect(groupParticipantTxMock.create).not.toHaveBeenCalled()
    // The count was taken inside the locked transaction (capacity is checked
    // under the lock, not before it).
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(lockAppointmentMock).toHaveBeenCalledTimes(1)
    expect(groupParticipantTxMock.count).toHaveBeenCalledTimes(1)
  })

  it("REJECTS when the count exceeds maxParticipants (>= guard, defends an already-oversold row)", async () => {
    groupParticipantTxMock.count.mockResolvedValue(MAX + 2)

    const res = await addGroupParticipant(APPT, CLIENT)

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/full/i)
    expect(groupParticipantTxMock.create).not.toHaveBeenCalled()
  })

  it("GRANTS the seat when one slot remains (count = max-1 -> create runs)", async () => {
    groupParticipantTxMock.count.mockResolvedValue(MAX - 1)

    const res = await addGroupParticipant(APPT, CLIENT)

    expect(res.success).toBe(true)
    // The participant is inserted for this appointment + client.
    expect(groupParticipantTxMock.create).toHaveBeenCalledTimes(1)
    const data = (
      groupParticipantTxMock.create.mock.calls[0] as unknown as [{ data: { appointmentId: string; clientId: string } }]
    )[0].data
    expect(data.appointmentId).toBe(APPT)
    expect(data.clientId).toBe(CLIENT)
  })

  it("takes the advisory lock BEFORE counting (count happens under the lock)", async () => {
    groupParticipantTxMock.count.mockResolvedValue(MAX - 1)

    await addGroupParticipant(APPT, CLIENT)

    // Lock is taken on (businessId, appointmentId) ahead of the re-count + insert,
    // so a concurrent grant can't slip between count and create.
    expect(lockAppointmentMock).toHaveBeenCalledTimes(1)
    expect((lockAppointmentMock.mock.calls[0] as unknown as [unknown, string, string])[1]).toBe(BIZ)
    expect((lockAppointmentMock.mock.calls[0] as unknown as [unknown, string, string])[2]).toBe(APPT)
    const lockOrder = lockAppointmentMock.mock.invocationCallOrder[0]
    const countOrder = groupParticipantTxMock.count.mock.invocationCallOrder[0]
    const createOrder = groupParticipantTxMock.create.mock.invocationCallOrder[0]
    expect(lockOrder).toBeLessThan(countOrder)
    expect(countOrder).toBeLessThan(createOrder)
  })

  it("rejects a non-group appointment before ever opening a transaction", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue({
      id: APPT,
      isGroupBooking: false,
      maxParticipants: MAX,
    })

    const res = await addGroupParticipant(APPT, CLIENT)

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/not a group booking/i)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(groupParticipantTxMock.create).not.toHaveBeenCalled()
  })
})
