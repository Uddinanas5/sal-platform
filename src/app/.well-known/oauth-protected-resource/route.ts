import { NextResponse } from "next/server"
import { OAUTH_ISSUER, OAUTH_RESOURCE } from "@/lib/oauth/metadata"

export function GET() {
  return NextResponse.json({
    resource: OAUTH_RESOURCE,
    authorization_servers: [OAUTH_ISSUER],
  })
}
