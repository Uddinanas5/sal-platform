import { createHmac, timingSafeEqual } from "node:crypto"

export type ReviewTokenPayload = {
  appointmentId: string
  exp: number
}

function getSecret() {
  const secret =
    process.env.REVIEW_TOKEN_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET
  if (!secret) {
    // Never fall back to a committed value — a known secret means forgeable
    // review tokens. NEXTAUTH_SECRET is already required at startup, so this
    // only ever fires in a misconfigured environment.
    throw new Error(
      "No review-token secret configured (set REVIEW_TOKEN_SECRET or NEXTAUTH_SECRET)",
    )
  }
  return secret
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url")
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url")
}

export function createReviewToken(appointmentId: string, expiresInDays = 14) {
  const payload: ReviewTokenPayload = {
    appointmentId,
    exp: Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60,
  }
  const encodedPayload = encode(JSON.stringify(payload))
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function verifyReviewToken(token: string, now = Math.floor(Date.now() / 1000)) {
  const [encodedPayload, signature] = token.split(".")
  if (!encodedPayload || !signature) return null

  const expected = sign(encodedPayload)
  const providedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(decode(encodedPayload)) as ReviewTokenPayload
    if (!payload.appointmentId || !payload.exp || payload.exp < now) return null
    return payload
  } catch {
    return null
  }
}
