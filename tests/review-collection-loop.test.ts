import { describe, it, expect, beforeEach, vi } from "vitest"

// Backs the "review collection loop" workstream: a tokenized post-visit request
// (sendReviewRequest) + a PUBLIC capture handler (submitPublicReview).
//
// Proven over a mock Prisma + mock auth-utils + mock email (no DB, no network):
//   - submitPublicReview creates a Review whose businessId / locationId / staffId
//     come from the VALIDATED TOKEN's appointment row — never from request input.
//     A businessId smuggled into the request body is ignored.
//   - a tampered / garbage / wrong-signature token is REJECTED and writes NOTHING.
//   - 4–5 stars are public AND routed to a configured Business.settings
//     googleReviewUrl; 1–3 stars stay private and are NEVER routed externally.
//   - sendReviewRequest scopes its appointment lookup to the SESSION businessId,
//     refuses non-completed visits, and signs a token over {appointmentId,
//     clientId} from the trusted row.

const SECRET = "test-secret-for-review-tokens"
// review-token reads NEXTAUTH_SECRET at call time via process.env.
process.env.NEXTAUTH_SECRET = SECRET

const {
  prismaMock,
  requireMinRoleMock,
  revalidatePathMock,
  sendEmailMock,
  rateLimitMock,
} = vi.hoisted(() => {
  const prismaMock = {
    appointment: { findFirst: vi.fn() },
    review: { create: vi.fn(), findFirst: vi.fn() },
  }
  return {
    prismaMock,
    requireMinRoleMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    sendEmailMock: vi.fn(),
    rateLimitMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({ requireMinRole: requireMinRoleMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }))

// Real token module (NOT mocked) so signing/verification is exercised end-to-end.
import { signReviewToken } from "@/lib/review-token"
import { sendReviewRequest, submitPublicReview } from "@/lib/actions/reviews"

// Valid v4 UUIDs.
const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"
const LOCATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const APPT = "55555555-5555-4555-8555-555555555555"
const CLIENT = "33333333-3333-4333-8333-333333333333"
const STAFF = "66666666-6666-4666-8666-666666666666"
const USER = "22222222-2222-4222-8222-222222222222"
const REVIEW = "77777777-7777-4777-8777-777777777777"

const GOOGLE_URL = "https://g.page/r/example/review"

function appointmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPT,
    businessId: BIZ,
    locationId: LOCATION,
    clientId: CLIENT,
    services: [{ staffId: STAFF }],
    business: { settings: { googleReviewUrl: GOOGLE_URL } },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.mockReturnValue({ limited: false, remaining: 4 })
  prismaMock.review.findFirst.mockResolvedValue(null) // no prior review by default
  prismaMock.review.create.mockResolvedValue({ id: REVIEW })
})

describe("submitPublicReview — token is the only source of truth", () => {
  it("creates a Review with businessId/locationId/staffId derived from the token's appointment, ignoring any input businessId", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(appointmentRow())
    const token = signReviewToken(APPT, CLIENT)

    const result = await submitPublicReview(token, {
      rating: 5,
      comment: "Best fade in town",
      // Attacker tries to smuggle a foreign businessId — must be ignored.
      businessId: OTHER_BIZ,
      staffId: "deadbeef",
    } as never)

    expect(result.success).toBe(true)

    // The appointment lookup is scoped to the token's verified pairing.
    const apptWhere = prismaMock.appointment.findFirst.mock.calls[0][0].where
    expect(apptWhere).toMatchObject({ id: APPT, clientId: CLIENT })

    // The created review carries ids from the trusted row, NOT from input.
    expect(prismaMock.review.create).toHaveBeenCalledTimes(1)
    const data = prismaMock.review.create.mock.calls[0][0].data
    expect(data.businessId).toBe(BIZ)
    expect(data.businessId).not.toBe(OTHER_BIZ)
    expect(data.locationId).toBe(LOCATION)
    expect(data.staffId).toBe(STAFF)
    expect(data.appointmentId).toBe(APPT)
    expect(data.clientId).toBe(CLIENT)
    expect(data.overallRating).toBe(5)
    expect(data.comment).toBe("Best fade in town")
    expect(data.isVerified).toBe(true)
  })

  it("REJECTS a tampered token and writes NOTHING", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(appointmentRow())
    const token = signReviewToken(APPT, CLIENT)
    // Flip the last character of the signature → signature mismatch.
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a")

    const result = await submitPublicReview(tampered, { rating: 5 })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/invalid|expired/i)
    expect(prismaMock.appointment.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.review.create).not.toHaveBeenCalled()
  })

  it("REJECTS a garbage / wrong-secret token and writes NOTHING", async () => {
    const result = await submitPublicReview("not-a-real-token", { rating: 4 })
    expect(result.success).toBe(false)
    expect(prismaMock.review.create).not.toHaveBeenCalled()
  })

  it("REJECTS a token whose appointment/client pairing no longer exists", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    const token = signReviewToken(APPT, CLIENT)

    const result = await submitPublicReview(token, { rating: 5 })
    expect(result.success).toBe(false)
    expect(prismaMock.review.create).not.toHaveBeenCalled()
  })

  it("routes 4–5 stars to the configured Google review URL and marks the review public", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(appointmentRow())
    const token = signReviewToken(APPT, CLIENT)

    const result = await submitPublicReview(token, { rating: 4 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.googleReviewUrl).toBe(GOOGLE_URL)
    expect(prismaMock.review.create.mock.calls[0][0].data.isPublic).toBe(true)
  })

  it("keeps 1–3 stars PRIVATE and never routes them externally", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(appointmentRow())
    const token = signReviewToken(APPT, CLIENT)

    const result = await submitPublicReview(token, { rating: 2, comment: "Too rushed" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.googleReviewUrl).toBeNull()
    const data = prismaMock.review.create.mock.calls[0][0].data
    expect(data.isPublic).toBe(false)
    expect(data.overallRating).toBe(2)
  })

  it("does not route 4–5 stars when no googleReviewUrl is configured", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(
      appointmentRow({ business: { settings: {} } })
    )
    const token = signReviewToken(APPT, CLIENT)

    const result = await submitPublicReview(token, { rating: 5 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.googleReviewUrl).toBeNull()
    // Still public, just no external destination.
    expect(prismaMock.review.create.mock.calls[0][0].data.isPublic).toBe(true)
  })

  it("rejects a duplicate submission for the same appointment", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(appointmentRow())
    prismaMock.review.findFirst.mockResolvedValue({ id: REVIEW }) // already reviewed
    const token = signReviewToken(APPT, CLIENT)

    const result = await submitPublicReview(token, { rating: 5 })
    expect(result.success).toBe(false)
    expect(prismaMock.review.create).not.toHaveBeenCalled()
  })

  it("rejects an out-of-range rating before any DB read", async () => {
    const token = signReviewToken(APPT, CLIENT)
    const result = await submitPublicReview(token, { rating: 9 })
    expect(result.success).toBe(false)
    expect(prismaMock.appointment.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.review.create).not.toHaveBeenCalled()
  })
})

describe("sendReviewRequest — staff-triggered, tenant-scoped", () => {
  beforeEach(() => {
    requireMinRoleMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "admin" })
    sendEmailMock.mockResolvedValue({ success: true })
  })

  it("scopes the appointment lookup to the SESSION businessId and emails the client", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({
      id: APPT,
      status: "completed",
      clientId: CLIENT,
      client: { id: CLIENT, email: "client@example.com", firstName: "Sam", emailConsent: true },
      business: { name: "Anas Barbershop" },
      services: [{ name: "Skin Fade", staff: { user: { firstName: "Jo", lastName: "Lee" } } }],
    })

    const result = await sendReviewRequest(APPT)
    expect(result.success).toBe(true)

    const where = prismaMock.appointment.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ id: APPT, businessId: BIZ })

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const mail = sendEmailMock.mock.calls[0][0]
    expect(mail.to).toBe("client@example.com")
    // The signed link is embedded; verify it decodes back to the right pairing.
    expect(mail.html).toMatch(/\/r\//)
  })

  it("returns failure (does NOT claim the client was emailed) when the provider rejects", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({
      id: APPT,
      status: "completed",
      clientId: CLIENT,
      client: { id: CLIENT, email: "client@example.com", firstName: "Sam", emailConsent: true },
      business: { name: "Anas Barbershop" },
      services: [{ name: "Skin Fade", staff: { user: { firstName: "Jo", lastName: "Lee" } } }],
    })
    // sendEmail never throws — it returns {success:false} when Resend is
    // unconfigured or the provider rejects. The action must surface that as a
    // failure so the button stops claiming "We emailed the client".
    sendEmailMock.mockResolvedValue({ success: false, error: "Email service not configured" })

    const result = await sendReviewRequest(APPT)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/could not send|try again/i)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it("refuses to send for a non-completed appointment", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({
      id: APPT,
      status: "confirmed",
      clientId: CLIENT,
      client: { id: CLIENT, email: "c@example.com", firstName: "Sam", emailConsent: true },
      business: { name: "Shop" },
      services: [],
    })

    const result = await sendReviewRequest(APPT)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/completed/i)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("returns a clean error when the appointment is not in the caller's business", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    const result = await sendReviewRequest(APPT)
    expect(result.success).toBe(false)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("does not email a client who opted out", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({
      id: APPT,
      status: "completed",
      clientId: CLIENT,
      client: { id: CLIENT, email: "c@example.com", firstName: "Sam", emailConsent: false },
      business: { name: "Shop" },
      services: [],
    })

    const result = await sendReviewRequest(APPT)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/opted out/i)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
