import { describe, it, expect, vi, beforeEach } from "vitest"

// L-034 — the two places that STAMP the watermark:
//   - resetPassword: auto-invalidates all prior sessions when a password is reset
//     (kills a stolen token the moment the real user resets).
//   - logOutEverywhere: explicit "sign out of all devices" action.

process.env.NEXTAUTH_SECRET = "test-secret-that-is-definitely-long-enough-32b"
process.env.STRIPE_SECRET_KEY = "sk_test_dummy"

const { prismaMock, jwtVerifyMock, rateLimitMock, getBusinessContextMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn(), update: vi.fn() } },
  jwtVerifyMock: vi.fn(),
  rateLimitMock: vi.fn(),
  getBusinessContextMock: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }))
vi.mock("jose", async (importOriginal) => ({ ...(await importOriginal<object>()), jwtVerify: jwtVerifyMock }))
vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: getBusinessContextMock }))

import { resetPassword } from "@/lib/actions/password-reset"
import { logOutEverywhere } from "@/lib/actions/account"

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.mockResolvedValue({ limited: false })
  prismaMock.user.update.mockResolvedValue({})
})

describe("resetPassword — auto-invalidates existing sessions (L-034)", () => {
  it("stamps sessionsValidAfter=now alongside the new password", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { purpose: "password-reset", userId: "u1", nonce: "abc" } })
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", metadata: { passwordResetNonce: "abc" } })

    const res = await resetPassword("tok", "brandNewPassw0rd")

    expect(res).toEqual({ success: true })
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1)
    const data = prismaMock.user.update.mock.calls[0][0].data
    expect(data.passwordHash).toBeTruthy()
    expect(data.sessionsValidAfter).toBeInstanceOf(Date)
  })
})

describe("logOutEverywhere — kills all sessions for the caller (L-034)", () => {
  it("stamps sessionsValidAfter=now for the current user", async () => {
    getBusinessContextMock.mockResolvedValue({ userId: "u1", businessId: "b1", role: "owner" })

    const res = await logOutEverywhere()

    expect(res).toEqual({ success: true, data: undefined })
    const call = prismaMock.user.update.mock.calls[0][0]
    expect(call.where).toEqual({ id: "u1" })
    expect(call.data.sessionsValidAfter).toBeInstanceOf(Date)
  })

  it("returns an auth error and writes nothing when not authenticated", async () => {
    getBusinessContextMock.mockRejectedValue(new Error("Not authenticated"))

    const res = await logOutEverywhere()

    expect(res.success).toBe(false)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})
