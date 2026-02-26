import crypto from "crypto"

/**
 * Verify a PKCE code_verifier against a stored code_challenge (S256 method).
 * Returns true if the verifier hashes to the challenge.
 */
export function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string
): boolean {
  const hash = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url")
  return hash === codeChallenge
}
