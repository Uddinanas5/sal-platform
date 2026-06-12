import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves ToS acceptance is PERSISTED at signup (adversarial ToS review,
// finding #4: the checkbox only enabled the submit button — no timestamp, no
// version, no proof anyone ever accepted the Terms). What must hold:
//
//   1. registerBusiness with agreedToTerms:true writes tosAcceptedAt (a real
//      timestamp) + tosVersion (the TOS_VERSION constant) on the User row.
//   2. agreedToTerms:false is rejected SERVER-SIDE (the checkbox gate alone
//      proves nothing — a crafted request must not mint an account without a
//      recorded acceptance) and creates NOTHING.
//   3. TOS_VERSION is the single source of truth: ISO-date shaped, and
//      formatTosVersion renders it timezone-independently (never via
//      `new Date("YYYY-MM-DD")`, which is UTC midnight and shows the previous
//      day in western timezones — this suite runs under test:tz).

const { prismaMock, txMock, sendEmailMock, rateLimitMock } = vi.hoisted(() => {
  // Bare vi.fn()s (loose arg typing) — resolved values are (re)applied in
  // beforeEach since vi.clearAllMocks() wipes call history each test.
  const txMock = {
    user: { create: vi.fn() },
    business: { create: vi.fn() },
    location: { create: vi.fn() },
    staff: { create: vi.fn() },
  }
  const prismaMock = {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  }
  return {
    prismaMock,
    txMock,
    sendEmailMock: vi.fn(async () => ({ success: true })),
    rateLimitMock: vi.fn(async () => ({ limited: false })),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
// Real bcrypt at cost 12 adds ~300ms per test for nothing — the hash value is
// irrelevant to what this suite proves.
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "hashed") } }))

import { registerBusiness } from "@/lib/actions/register"
import { TOS_VERSION, formatTosVersion } from "@/lib/tos-version"

const VALID_INPUT = {
  businessName: "Test Salon",
  firstName: "Anas",
  lastName: "Uddin",
  email: "owner@shop.com",
  password: "longenough",
  agreedToTerms: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockResolvedValue(null) // email not taken
  txMock.user.create.mockResolvedValue({
    id: "user_1",
    firstName: "Anas",
    email: "owner@shop.com",
  })
  txMock.business.create.mockResolvedValue({ id: "biz_1" })
  txMock.location.create.mockResolvedValue({ id: "loc_1" })
  txMock.staff.create.mockResolvedValue({ id: "staff_1" })
})

describe("registerBusiness — ToS acceptance proof", () => {
  it("persists tosAcceptedAt + tosVersion on the created user", async () => {
    const before = Date.now()
    const result = await registerBusiness(VALID_INPUT)
    const after = Date.now()

    expect(result).toEqual({ success: true })
    expect(txMock.user.create).toHaveBeenCalledTimes(1)
    const data = txMock.user.create.mock.calls[0][0].data

    // The recorded acceptance: a real timestamp from THIS request...
    expect(data.tosAcceptedAt).toBeInstanceOf(Date)
    expect(data.tosAcceptedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(data.tosAcceptedAt.getTime()).toBeLessThanOrEqual(after)
    // ...and WHICH revision was accepted — the same constant /terms renders.
    expect(data.tosVersion).toBe(TOS_VERSION)
  })

  it("rejects agreedToTerms:false server-side and creates nothing", async () => {
    const result = await registerBusiness({ ...VALID_INPUT, agreedToTerms: false })

    expect(result).toEqual({
      success: false,
      error: "You must agree to the Terms of Service to create an account",
    })
    // Validation fails BEFORE any side effect: no rate-limit consumption is
    // required, but absolutely no account may be minted.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(txMock.user.create).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("TOS_VERSION is ISO-date shaped and renders timezone-independently", () => {
    expect(TOS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Pure string formatting — the same output on a UTC host and a New York
    // host (a Date-based formatter would render the previous day in the west).
    expect(formatTosVersion("2026-06-11")).toBe("June 11, 2026")
    expect(formatTosVersion(TOS_VERSION)).not.toBe(TOS_VERSION)
  })
})
