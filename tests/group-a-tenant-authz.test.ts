import { describe, it, expect, beforeEach, vi } from "vitest"

// GROUP A — TENANT-ISOLATION + AUTHZ. Four fixes, one mock-Prisma suite (no DB):
//
//  1. updateStaffProfile (actions/staff.ts) must be admin-gated AND tenant-scoped
//     — a tenant-A admin can't rewrite tenant-B's staff name/phone/commission.
//  2. issueGiftCard (actions/gift-cards.ts) must require admin — a staff-role
//     caller can't mint stored value then redeem it at checkout.
//  3. redeemGiftCard (actions/gift-cards.ts) must redeem inside a $transaction
//     via the advisory-locked in-tx helper — two concurrent redemptions can't
//     both pass the balance check and drive currentBalance negative (TOCTOU).
//  4. MCP cancel-recurring-series (mcp/tools/appointments.ts) must run the same
//     canAccessAppointmentSeries staff-authz check its sibling tools use — a
//     staff-role API key can't mass-cancel a series it isn't assigned to.

// ---------------------------------------------------------------------------
// Shared hoisted mocks. vi.mock factories are hoisted above imports, so every
// symbol they reference must come from vi.hoisted (copied from
// tests/checkout-loyalty.test.ts / mcp-checkout-tool.test.ts patterns).
// ---------------------------------------------------------------------------
const {
  prismaMock,
  giftCardTxMock,
  requireMinRoleMock,
  getBusinessContextMock,
  lockGiftCardMock,
  canAccessAppointmentSeriesMock,
} = vi.hoisted(() => {
  // A single shared gift-card row the in-tx helper reads/decrements. Stateful so
  // the concurrency test can observe whether two reads both saw the full balance.
  const giftCardTxMock = {
    findFirst: vi.fn(),
    update: vi.fn(),
  }
  const prismaMock = {
    staff: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { update: vi.fn() },
    giftCard: { findFirst: vi.fn(), create: vi.fn() },
    business: { findUnique: vi.fn() },
    appointment: { updateMany: vi.fn() },
    // $transaction runs the callback against a tx that exposes the gift-card
    // model (the only model redeemGiftCardInTx touches besides $executeRaw).
    // Variadic so calls capture the second (options) arg too.
    $transaction: vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (cb: (tx: unknown) => unknown, ..._rest: any[]) =>
        cb({ $executeRaw: vi.fn(), giftCard: giftCardTxMock }),
    ),
  }
  return {
    prismaMock,
    giftCardTxMock,
    requireMinRoleMock: vi.fn(),
    getBusinessContextMock: vi.fn(),
    lockGiftCardMock: vi.fn(),
    canAccessAppointmentSeriesMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({
  requireMinRole: requireMinRoleMock,
  getBusinessContext: getBusinessContextMock,
}))
// Keep redeemGiftCardInTx REAL (it owns the lock → re-read → decrement logic we
// want to prove), but neutralize the raw advisory-lock SQL so there is no DB.
// Provide the other exports too (appointments.ts imports them) so the module
// graph resolves; only lockGiftCard is exercised here.
vi.mock("@/lib/db/advisory-lock", () => ({
  lockGiftCard: lockGiftCardMock,
  lockStaffSchedule: vi.fn(),
  lockClient: vi.fn(),
  isBookingContentionError: vi.fn(() => false),
}))
// MCP series-authz helper — assert the tool calls it and honors a deny.
vi.mock("@/lib/api/appointment-access", () => ({
  canAccessAppointment: vi.fn(async () => true),
  canAccessAppointmentSeries: canAccessAppointmentSeriesMock,
}))
import { updateStaffProfile } from "@/lib/actions/staff"
import { issueGiftCard, redeemGiftCard } from "@/lib/actions/gift-cards"
import { registerAppointmentTools } from "@/lib/mcp/tools/appointments"

// Valid v4 UUIDs (version "4" + variant "8/9/a/b" nibbles — Zod's .uuid()).
const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"
const STAFF = "22222222-2222-4222-8222-222222222222"
const SERIES = "44444444-4444-4444-8444-444444444444"
const USER = "55555555-5555-4555-8555-555555555555"

beforeEach(() => {
  vi.clearAllMocks()
  requireMinRoleMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
  getBusinessContextMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
  lockGiftCardMock.mockResolvedValue(undefined)
})

// ===========================================================================
// 1. updateStaffProfile — admin gate + tenant scoping
// ===========================================================================
describe("updateStaffProfile — tenant isolation + admin gate", () => {
  it("requires admin/owner (rejects when requireMinRole throws for staff)", async () => {
    requireMinRoleMock.mockRejectedValue(new Error("Insufficient permissions: requires admin role"))

    const res = await updateStaffProfile({ staffId: STAFF, commissionRate: 50 })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/insufficient permissions/i)
    // No lookup or write happened — the gate ran first.
    expect(prismaMock.staff.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.staff.updateMany).not.toHaveBeenCalled()
  })

  it("scopes the lookup to the caller's business — a foreign staff UUID is not found", async () => {
    // findFirst is tenant-scoped on { id, primaryLocation: { businessId } }; a
    // staff member in another business resolves to null.
    prismaMock.staff.findFirst.mockImplementation(
      async (args: { where: { id: string; primaryLocation: { businessId: string } } }) =>
        args.where.primaryLocation.businessId === BIZ ? { userId: USER } : null,
    )
    // The admin belongs to OTHER_BIZ and targets a STAFF owned by BIZ.
    requireMinRoleMock.mockResolvedValue({ businessId: OTHER_BIZ, userId: USER, role: "admin" })

    const res = await updateStaffProfile({ staffId: STAFF, firstName: "Mallory", commissionRate: 99 })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("Staff member not found")
    // The lookup carried the caller's (foreign) businessId, never trusted input.
    expect(prismaMock.staff.findFirst.mock.calls[0][0].where).toEqual({
      id: STAFF,
      primaryLocation: { businessId: OTHER_BIZ },
    })
    // Nothing was written across the tenant boundary.
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.staff.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.staff.update).not.toHaveBeenCalled()
  })

  it("writes name/phone + commission only when the staff is in-tenant (and re-asserts the filter)", async () => {
    prismaMock.staff.findFirst.mockResolvedValue({ userId: USER })
    prismaMock.staff.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.update.mockResolvedValue({ id: USER })

    const res = await updateStaffProfile({
      staffId: STAFF,
      firstName: "Sam",
      phone: "555-0100",
      commissionRate: 40,
    })

    expect(res.success).toBe(true)
    // User write targets the resolved in-tenant user id.
    expect(prismaMock.user.update.mock.calls[0][0].where).toEqual({ id: USER })
    // Staff write re-asserts the tenant filter (defense-in-depth) via updateMany.
    expect(prismaMock.staff.updateMany.mock.calls[0][0].where).toEqual({
      id: STAFF,
      primaryLocation: { businessId: BIZ },
    })
    expect(prismaMock.staff.updateMany.mock.calls[0][0].data.commissionRate).toBe(40)
  })
})

// ===========================================================================
// 2. issueGiftCard — admin gate (no staff minting)
// ===========================================================================
describe("issueGiftCard — admin gate", () => {
  it("rejects a staff-role caller (requireMinRole admin) without minting value", async () => {
    requireMinRoleMock.mockRejectedValue(new Error("Insufficient permissions: requires admin role"))

    const res = await issueGiftCard({ code: "GIFT-ABCD-1234", initialValue: 100 })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/insufficient permissions/i)
    // No card was created — minting is gated.
    expect(prismaMock.giftCard.create).not.toHaveBeenCalled()
    expect(requireMinRoleMock).toHaveBeenCalledWith("admin")
  })

  it("mints for an admin, scoping the card to the caller's business", async () => {
    prismaMock.giftCard.findFirst.mockResolvedValue(null)
    prismaMock.business.findUnique.mockResolvedValue({ currency: "USD" })
    prismaMock.giftCard.create.mockResolvedValue({ id: "gc_1", code: "GIFT-ABCD-1234" })

    const res = await issueGiftCard({ code: "GIFT-ABCD-1234", initialValue: 100 })

    expect(res.success).toBe(true)
    expect(prismaMock.giftCard.create.mock.calls[0][0].data.businessId).toBe(BIZ)
    expect(prismaMock.giftCard.create.mock.calls[0][0].data.currentBalance).toBe(100)
  })
})

// ===========================================================================
// 3. redeemGiftCard — concurrency-safe (advisory lock + in-tx re-read)
// ===========================================================================
describe("redeemGiftCard — concurrency safety", () => {
  it("redeems inside a $transaction and takes the gift-card advisory lock first", async () => {
    giftCardTxMock.findFirst.mockResolvedValue({
      id: "gc_1",
      currentBalance: 50,
      expiresAt: null,
    })
    giftCardTxMock.update.mockResolvedValue({})

    const res = await redeemGiftCard({ code: "GIFT-ABCD-1234", amount: 20 })

    expect(res.success).toBe(true)
    if (res.success) expect(res.data.remainingBalance).toBe(30)
    // Wrapped in a transaction with the contention-survival timeouts.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.$transaction.mock.calls[0][1]).toEqual({ timeout: 20000, maxWait: 15000 })
    // The advisory lock was taken on (businessId, code) before the decrement.
    expect(lockGiftCardMock).toHaveBeenCalledTimes(1)
    expect(lockGiftCardMock.mock.calls[0][1]).toBe(BIZ)
    expect(lockGiftCardMock.mock.calls[0][2]).toBe("GIFT-ABCD-1234")
    const lockOrder = lockGiftCardMock.mock.invocationCallOrder[0]
    const writeOrder = giftCardTxMock.update.mock.invocationCallOrder[0]
    expect(lockOrder).toBeLessThan(writeOrder)
  })

  it("rejects when the in-tx balance is insufficient — never writes a negative balance", async () => {
    // The lock serializes; the in-tx helper re-reads $40 and refuses a $50 spend.
    giftCardTxMock.findFirst.mockResolvedValue({
      id: "gc_1",
      currentBalance: 40,
      expiresAt: null,
    })

    const res = await redeemGiftCard({ code: "GIFT-ABCD-1234", amount: 50 })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toMatch(/insufficient/i)
    // No decrement happened, so the balance can't go negative.
    expect(giftCardTxMock.update).not.toHaveBeenCalled()
  })

  it("serialized concurrent redemptions can't double-spend a $50 card", async () => {
    // Model the advisory lock: only one redemption holds the lock at a time, and
    // the in-tx findFirst re-reads the LATEST balance under that lock (exactly
    // how pg_advisory_xact_lock + a fresh SELECT behaves). A pre-fix
    // (read-then-write, no lock) would let both reads see $50 and both succeed.
    let balance = 50
    let locked = false
    const waiters: Array<() => void> = []
    lockGiftCardMock.mockImplementation(async () => {
      if (locked) {
        await new Promise<void>((resolve) => waiters.push(resolve))
      }
      locked = true
    })
    const releaseLock = () => {
      locked = false
      const next = waiters.shift()
      if (next) next()
    }
    // findFirst re-reads the CURRENT balance (post-lock), update mutates it, and
    // $transaction releases the lock when the callback resolves/rejects.
    giftCardTxMock.findFirst.mockImplementation(async () => ({
      id: "gc_1",
      currentBalance: balance,
      expiresAt: null,
    }))
    giftCardTxMock.update.mockImplementation(async (args: { data: { currentBalance: number } }) => {
      balance = args.data.currentBalance
      return {}
    })
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: unknown) => unknown) => {
        try {
          return await cb({ $executeRaw: vi.fn(), giftCard: giftCardTxMock })
        } finally {
          releaseLock()
        }
      },
    )

    // Two concurrent $40 redemptions against a $50 card. Only one can succeed.
    const [r1, r2] = await Promise.all([
      redeemGiftCard({ code: "GIFT-ABCD-1234", amount: 40 }),
      redeemGiftCard({ code: "GIFT-ABCD-1234", amount: 40 }),
    ])

    const successes = [r1, r2].filter((r) => r.success)
    expect(successes).toHaveLength(1)
    // The card never went negative: the survivor left exactly $10.
    expect(balance).toBe(10)
    expect(balance).toBeGreaterThanOrEqual(0)
    // Exactly one decrement was applied.
    expect(giftCardTxMock.update).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// 4. MCP cancel-recurring-series — staff authz
// ===========================================================================
type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: "text"; text: string }[]
  isError?: boolean
}>

function loadCancelSeriesTool(ctx: { userId: string; businessId: string; role: string }) {
  let handler: ToolHandler | undefined
  const fakeServer = {
    tool: (name: string, _desc: string, _schema: unknown, h: ToolHandler) => {
      if (name === "cancel-recurring-series") handler = h
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAppointmentTools(fakeServer as any, ctx as any)
  if (!handler) throw new Error("cancel-recurring-series tool not registered")
  return handler
}

const parse = (out: { content: { text: string }[] }) => JSON.parse(out.content[0].text)

describe("MCP cancel-recurring-series — staff authz", () => {
  it("rejects a staff caller not assigned to the series (Forbidden, no write)", async () => {
    canAccessAppointmentSeriesMock.mockResolvedValue(false)
    const handler = loadCancelSeriesTool({ userId: USER, businessId: BIZ, role: "staff" })

    const out = await handler({ seriesId: SERIES })

    expect(out.isError).toBe(true)
    expect(parse(out).error).toMatch(/forbidden/i)
    // The access check was made for this series, and no cancellation ran.
    expect(canAccessAppointmentSeriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BIZ, role: "staff" }),
      SERIES,
    )
    expect(prismaMock.appointment.updateMany).not.toHaveBeenCalled()
  })

  it("allows an authorized caller and scopes the cancel by businessId", async () => {
    canAccessAppointmentSeriesMock.mockResolvedValue(true)
    prismaMock.appointment.updateMany.mockResolvedValue({ count: 3 })
    const handler = loadCancelSeriesTool({ userId: USER, businessId: BIZ, role: "admin" })

    const out = await handler({ seriesId: SERIES })

    expect(out.isError).toBeUndefined()
    expect(parse(out).cancelledCount).toBe(3)
    const where = prismaMock.appointment.updateMany.mock.calls[0][0].where
    expect(where.businessId).toBe(BIZ)
    expect(where.seriesId).toBe(SERIES)
  })
})
