import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// L-038 — account-existence must not leak via response TIMING. Two paths:
//   (1) login skipped bcrypt entirely for an unknown email (fast) vs a real wrong
//       password (slow bcrypt) → now a dummy bcrypt.compare runs on the no-user branch;
//   (2) requestPasswordReset AWAITED the email send only when the user existed → now
//       it's fire-and-forget, so both branches return in comparable time.

process.env.NEXTAUTH_SECRET = "test-secret-that-is-definitely-long-enough-32b"

const { prismaMock, rateLimitMock, sendEmailMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn(), update: vi.fn() } },
  rateLimitMock: vi.fn(),
  sendEmailMock: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("@/lib/email-templates", () => ({ passwordResetEmail: () => "<html>reset</html>" }))

import { requestPasswordReset } from "@/lib/actions/password-reset"

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.mockResolvedValue({ limited: false })
  prismaMock.user.update.mockResolvedValue({})
})

describe("requestPasswordReset — no account enumeration via timing (L-038)", () => {
  it("does NOT block on the email send for a real user (fire-and-forget)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "real@x.com", firstName: "Real", metadata: {} })
    // A promise that never resolves: if the action AWAITED the email, this test would hang.
    let resolveEmail: () => void = () => {}
    sendEmailMock.mockReturnValue(new Promise<void>((r) => { resolveEmail = () => r() }))

    const res = await requestPasswordReset("real@x.com")

    expect(res).toEqual({ success: true })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    resolveEmail()
  })

  it("returns the SAME uniform success for a non-existent user (and sends no email)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await requestPasswordReset("ghost@x.com")

    expect(res).toEqual({ success: true })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})

// authorize() is a non-exported credentials-provider closure — lock the login side
// with a source-guard: the no-user branch must spend a bcrypt.compare before failing.
describe("login refuses to leak account existence via timing (L-038 wiring)", () => {
  it("auth.ts runs bcrypt.compare on the no-user branch before returning null", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/auth.ts"), "utf8")
    expect(
      /if \(!user \|\| !user\.passwordHash\) \{[\s\S]*?bcrypt\.compare\([\s\S]*?dummyLoginHash\(\)\)[\s\S]*?return null/.test(src),
      "auth.ts should bcrypt.compare against the dummy hash on the no-user branch (L-038)",
    ).toBe(true)
  })
})
