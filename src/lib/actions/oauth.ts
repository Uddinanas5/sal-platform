"use server"

import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { getBusinessContext } from "@/lib/auth-utils"
import { OAUTH_TTL } from "@/lib/oauth/metadata"

interface ApproveConsentInput {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  codeChallengeMethod: string
  scope: string
}

export async function approveOAuthConsent(
  input: ApproveConsentInput
): Promise<
  { success: true; data: { redirectUrl: string } } | { success: false; error: string }
> {
  const ctx = await getBusinessContext()
  if (!ctx) {
    return { success: false, error: "Not authenticated" }
  }

  // Verify client exists
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: input.clientId },
  })
  if (!client) {
    return { success: false, error: "Unknown client" }
  }

  // Validate redirect_uri
  if (!client.redirectUris.includes(input.redirectUri)) {
    return { success: false, error: "Invalid redirect URI" }
  }

  // Generate authorization code
  const rawCode = crypto.randomBytes(32).toString("hex")
  const codeHash = crypto.createHash("sha256").update(rawCode).digest("hex")

  await prisma.oAuthAuthorizationCode.create({
    data: {
      codeHash,
      clientId: input.clientId,
      userId: ctx.userId,
      businessId: ctx.businessId,
      redirectUri: input.redirectUri,
      scope: input.scope,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod || "S256",
      expiresAt: new Date(
        Date.now() + OAUTH_TTL.authorizationCodeSeconds * 1000
      ),
    },
  })

  // Build redirect URL
  const url = new URL(input.redirectUri)
  url.searchParams.set("code", rawCode)
  if (input.state) {
    url.searchParams.set("state", input.state)
  }

  return { success: true, data: { redirectUrl: url.toString() } }
}
