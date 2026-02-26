import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { verifyPkceChallenge } from "@/lib/oauth/pkce"
import { OAUTH_TTL } from "@/lib/oauth/metadata"

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return oauthError(
      "invalid_request",
      "Content-Type must be application/x-www-form-urlencoded",
      400
    )
  }

  const formData = await req.formData()
  const grantType = formData.get("grant_type") as string | null
  const code = formData.get("code") as string | null
  const codeVerifier = formData.get("code_verifier") as string | null
  const clientId = formData.get("client_id") as string | null
  const redirectUri = formData.get("redirect_uri") as string | null

  if (grantType !== "authorization_code") {
    return oauthError("unsupported_grant_type", "Only authorization_code is supported", 400)
  }

  if (!code || !codeVerifier || !clientId) {
    return oauthError("invalid_request", "Missing required parameters: code, code_verifier, client_id", 400)
  }

  // Look up the authorization code
  const codeHash = crypto.createHash("sha256").update(code).digest("hex")
  const authCode = await prisma.oAuthAuthorizationCode.findUnique({
    where: { codeHash },
  })

  if (!authCode) {
    return oauthError("invalid_grant", "Invalid authorization code", 400)
  }

  // Validate: not expired, not used, correct client, correct redirect_uri
  if (authCode.expiresAt < new Date()) {
    return oauthError("invalid_grant", "Authorization code has expired", 400)
  }

  if (authCode.usedAt) {
    return oauthError("invalid_grant", "Authorization code has already been used", 400)
  }

  if (authCode.clientId !== clientId) {
    return oauthError("invalid_grant", "Client ID mismatch", 400)
  }

  if (redirectUri && authCode.redirectUri !== redirectUri) {
    return oauthError("invalid_grant", "Redirect URI mismatch", 400)
  }

  // Verify PKCE
  if (!verifyPkceChallenge(codeVerifier, authCode.codeChallenge)) {
    return oauthError("invalid_grant", "PKCE verification failed", 400)
  }

  // Mark code as used
  await prisma.oAuthAuthorizationCode.update({
    where: { id: authCode.id },
    data: { usedAt: new Date() },
  })

  // Generate access token
  const rawToken = `sal_oauth_${crypto.randomBytes(32).toString("hex")}`
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const tokenPrefix = rawToken.slice(0, 16)

  await prisma.oAuthAccessToken.create({
    data: {
      tokenHash,
      tokenPrefix,
      clientId: authCode.clientId,
      userId: authCode.userId,
      businessId: authCode.businessId,
      scope: authCode.scope ?? "mcp",
      expiresAt: new Date(
        Date.now() + OAUTH_TTL.accessTokenSeconds * 1000
      ),
    },
  })

  return NextResponse.json({
    access_token: rawToken,
    token_type: "Bearer",
    expires_in: OAUTH_TTL.accessTokenSeconds,
    scope: authCode.scope ?? "mcp",
  })
}

function oauthError(
  error: string,
  description: string,
  status: number
): NextResponse {
  return NextResponse.json(
    { error, error_description: description },
    { status }
  )
}
