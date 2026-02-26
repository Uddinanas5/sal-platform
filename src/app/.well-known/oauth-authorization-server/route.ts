import { NextResponse } from "next/server"
import {
  OAUTH_ISSUER,
  OAUTH_ENDPOINTS,
  OAUTH_SUPPORTED,
} from "@/lib/oauth/metadata"

export function GET() {
  return NextResponse.json({
    issuer: OAUTH_ISSUER,
    authorization_endpoint: OAUTH_ENDPOINTS.authorization,
    token_endpoint: OAUTH_ENDPOINTS.token,
    registration_endpoint: OAUTH_ENDPOINTS.registration,
    response_types_supported: [...OAUTH_SUPPORTED.responseTypes],
    grant_types_supported: [...OAUTH_SUPPORTED.grantTypes],
    code_challenge_methods_supported: [
      ...OAUTH_SUPPORTED.codeChallengeMethodsSupported,
    ],
    token_endpoint_auth_methods_supported: [
      ...OAUTH_SUPPORTED.tokenEndpointAuthMethods,
    ],
    scopes_supported: [...OAUTH_SUPPORTED.scopes],
  })
}
