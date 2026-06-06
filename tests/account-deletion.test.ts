import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the honest account-deletion request (`requestAccountDeletion`) over a
// mock Prisma + mock auth-utils + mock email (no DB, no network):
//   - OWNER-ONLY: a staff/admin caller is rejected and writes nothing
//   - the owner must re-type the EXACT business name — a mismatch is rejected
//   - ownerId is verified against the session userId (defense in depth)
//   - on success: subscriptionStatus -> "cancelled", an AuditLog row is written
//     (action "delete_requested"), and support@meetsal.ai is emailed
//   - there is NO hard-delete of the business (no business.delete is called)

const { prismaMock, getBusinessContextMock, sendEmailMock, revalidatePathMock } = vi.hoisted(() => {
  const txMock = {
    business: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  }
  const prismaMock = {
    business: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: unknown) => {
      if (typeof fn === "function") return (fn as (tx: unknown) => unknown)(txMock)
      return undefined
    }),
    __tx: txMock,
  }
  return {
    prismaMock,
    getBusinessContextMock: vi.fn(),
    sendEmailMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: getBusinessContextMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

import { requestAccountDeletion } from "@/lib/actions/account"

const BIZ = "11111111-1111-4111-8111-111111111111"
const OWNER = "22222222-2222-4222-8222-222222222222"
const OTHER_USER = "33333333-3333-4333-8333-333333333333"
const BIZ_NAME = "Anas Barbershop"

beforeEach(() => {
  vi.clearAllMocks()
  getBusinessContextMock.mockResolvedValue({ userId: OWNER, businessId: BIZ, role: "owner" })
  prismaMock.business.findUnique.mockResolvedValue({
    id: BIZ,
    name: BIZ_NAME,
    email: "shop@example.com",
    subscriptionStatus: "active",
    ownerId: OWNER,
  })
  prismaMock.user.findUnique.mockResolvedValue({
    email: "owner@example.com",
    firstName: "Anas",
    lastName: "U",
  })
  sendEmailMock.mockResolvedValue({ success: true })
})

describe("requestAccountDeletion — authorization (owner only)", () => {
  it("rejects an admin (non-owner) and writes nothing", async () => {
    getBusinessContextMock.mockResolvedValue({ userId: OTHER_USER, businessId: BIZ, role: "admin" })

    const res = await requestAccountDeletion({ confirmName: BIZ_NAME })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error).toMatch(/owner/i)
    // No lookup, no mutation, no email, no hard-delete.
    expect(prismaMock.business.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.business.delete).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("rejects a staff caller", async () => {
    getBusinessContextMock.mockResolvedValue({ userId: OTHER_USER, businessId: BIZ, role: "staff" })

    const res = await requestAccountDeletion({ confirmName: BIZ_NAME })

    expect(res.success).toBe(false)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("rejects when the session role is owner but ownerId does not match the user", async () => {
    // Role says owner, but the business is actually owned by someone else.
    getBusinessContextMock.mockResolvedValue({ userId: OTHER_USER, businessId: BIZ, role: "owner" })

    const res = await requestAccountDeletion({ confirmName: BIZ_NAME })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error).toMatch(/owner/i)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.business.delete).not.toHaveBeenCalled()
  })

  it("returns the auth error and writes nothing with no business context", async () => {
    getBusinessContextMock.mockRejectedValueOnce(new Error("No business context"))

    const res = await requestAccountDeletion({ confirmName: BIZ_NAME })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error).toBe("No business context")
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe("requestAccountDeletion — name confirmation guardrail", () => {
  it("rejects when the typed name does not match the business name", async () => {
    const res = await requestAccountDeletion({ confirmName: "Wrong Name" })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error).toMatch(/does not match/i)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.business.delete).not.toHaveBeenCalled()
  })

  it("rejects an empty confirmation (zod validation)", async () => {
    const res = await requestAccountDeletion({ confirmName: "" })
    expect(res.success).toBe(false)
    expect(prismaMock.business.findUnique).not.toHaveBeenCalled()
  })

  it("accepts a name with surrounding whitespace (trimmed match)", async () => {
    const res = await requestAccountDeletion({ confirmName: `  ${BIZ_NAME}  ` })
    expect(res.success).toBe(true)
  })
})

describe("requestAccountDeletion — recorded effects (no hard-delete)", () => {
  it("cancels the subscription, writes an audit log, and emails support", async () => {
    const res = await requestAccountDeletion({ confirmName: BIZ_NAME })

    expect(res.success).toBe(true)

    // subscriptionStatus -> cancelled, scoped to the business id.
    expect(prismaMock.__tx.business.update).toHaveBeenCalledTimes(1)
    const update = prismaMock.__tx.business.update.mock.calls[0][0]
    expect(update.where).toEqual({ id: BIZ })
    expect(update.data.subscriptionStatus).toBe("cancelled")

    // AuditLog row records the deletion request.
    expect(prismaMock.__tx.auditLog.create).toHaveBeenCalledTimes(1)
    const audit = prismaMock.__tx.auditLog.create.mock.calls[0][0].data
    expect(audit.action).toBe("delete_requested")
    expect(audit.entityType).toBe("Business")
    expect(audit.entityId).toBe(BIZ)
    expect(audit.businessId).toBe(BIZ)
    expect(audit.userId).toBe(OWNER)

    // support@meetsal.ai is notified.
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const mail = sendEmailMock.mock.calls[0][0]
    expect(mail.to).toBe("support@meetsal.ai")
    expect(mail.subject).toContain(BIZ_NAME)

    // NEVER a hard delete of a business with bookings.
    expect(prismaMock.business.delete).not.toHaveBeenCalled()
  })

  it("still succeeds when the notification email fails (request is the source of truth)", async () => {
    sendEmailMock.mockResolvedValueOnce({ success: false, error: "Email service not configured" })

    const res = await requestAccountDeletion({ confirmName: BIZ_NAME })

    expect(res.success).toBe(true)
    expect(prismaMock.__tx.business.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.__tx.auditLog.create).toHaveBeenCalledTimes(1)
  })
})
