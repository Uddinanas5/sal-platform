import { describe, expect, it } from "vitest"

// review-token reads its secret from process.env at call time. The production
// code no longer falls back to a hardcoded dev secret (that made tokens
// forgeable), so the test must supply one — mirroring review-collection-loop.
process.env.NEXTAUTH_SECRET = "test-review-token-secret"

import { createReviewToken, verifyReviewToken } from "@/lib/reviews/review-token"

describe("review tokens", () => {
  it("round-trips a valid appointment token", () => {
    const token = createReviewToken("appointment-123", 1)
    const payload = verifyReviewToken(token)

    expect(payload?.appointmentId).toBe("appointment-123")
  })

  it("rejects tampered tokens", () => {
    const token = createReviewToken("appointment-123", 1)
    const [payload, signature] = token.split(".")
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...decoded, appointmentId: "different-123" })
    ).toString("base64url")

    expect(verifyReviewToken(`${tamperedPayload}.${signature}`)).toBeNull()
  })

  it("rejects expired tokens", () => {
    const token = createReviewToken("appointment-123", -1)

    expect(verifyReviewToken(token)).toBeNull()
  })
})
