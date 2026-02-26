const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

export const OAUTH_ISSUER = BASE_URL
export const OAUTH_RESOURCE = `${BASE_URL}/api/mcp`

export const OAUTH_ENDPOINTS = {
  authorization: `${BASE_URL}/oauth/authorize`,
  token: `${BASE_URL}/api/oauth/token`,
  registration: `${BASE_URL}/api/oauth/register`,
}

export const OAUTH_SUPPORTED = {
  responseTypes: ["code"] as const,
  grantTypes: ["authorization_code"] as const,
  codeChallengeMethodsSupported: ["S256"] as const,
  tokenEndpointAuthMethods: ["none"] as const,
  scopes: ["mcp"] as const,
}

export const OAUTH_TTL = {
  authorizationCodeSeconds: 60,
  accessTokenSeconds: 7 * 24 * 60 * 60, // 7 days
}
