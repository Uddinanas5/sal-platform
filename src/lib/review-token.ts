import { createHmac, timingSafeEqual } from "crypto"

/**
 * Signed, self-contained review-request token.
 *
 * The token encodes the {appointmentId, clientId} pair and is signed with an
 * HMAC over the server secret (NEXTAUTH_SECRET — already present in every
 * environment). It exists so a post-visit email can carry a link the recipient
 * can use to leave a review WITHOUT logging in, while the public submit handler
 * derives business/staff/appointment strictly from the *validated* token — never
 * from request input. No new DB column: the token is stateless.
 *
 * Format:  base64url(json payload) "." base64url(hmac-sha256)
 *
 * NOTE on revocation: because the token is stateless we cannot revoke a single
 * link without a DB field (frozen schema). Tampering is still impossible (HMAC),
 * and the submit handler re-validates that the appointment still belongs to the
 * encoded client/business at write time, so a stale token can at worst create a
 * legitimate review for the real visit it was issued for.
 */

export type ReviewTokenPayload = {
  /** appointment the review is about */
  a: string
  /** client the review is from */
  c: string
  /** issued-at (epoch seconds) — lets us optionally expire links later */
  iat: number
}

export type DecodedReviewToken = {
  appointmentId: string
  clientId: string
  issuedAt: number
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    // Fail closed: without a secret we cannot sign or verify safely.
    throw new Error("NEXTAUTH_SECRET is not set — cannot sign review tokens")
  }
  return secret
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4))
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64")
}

function sign(data: string): string {
  return b64url(createHmac("sha256", getSecret()).update(data).digest())
}

/**
 * Build a review-request token for an (appointment, client) pair.
 * The caller MUST have already verified this pairing against the DB (server-side,
 * tenant-scoped) before issuing the token.
 */
export function signReviewToken(appointmentId: string, clientId: string): string {
  const payload: ReviewTokenPayload = {
    a: appointmentId,
    c: clientId,
    iat: Math.floor(Date.now() / 1000),
  }
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"))
  const mac = sign(body)
  return `${body}.${mac}`
}

/**
 * Validate a token's signature and structure. Returns the decoded ids, or null
 * for any tampered / malformed / wrong-signature token. NEVER throws on bad
 * input so callers can treat null as "invalid link".
 */
export function verifyReviewToken(token: string | undefined | null): DecodedReviewToken | null {
  if (!token || typeof token !== "string") return null
  const dot = token.indexOf(".")
  if (dot <= 0 || dot === token.length - 1) return null

  const body = token.slice(0, dot)
  const providedMac = token.slice(dot + 1)

  // Constant-time signature comparison over the canonical bytes.
  const expectedMac = sign(body)
  const a = Buffer.from(providedMac)
  const b = Buffer.from(expectedMac)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let payload: ReviewTokenPayload
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"))
  } catch {
    return null
  }

  if (
    !payload ||
    typeof payload.a !== "string" ||
    typeof payload.c !== "string" ||
    payload.a.length === 0 ||
    payload.c.length === 0
  ) {
    return null
  }

  return { appointmentId: payload.a, clientId: payload.c, issuedAt: payload.iat ?? 0 }
}
