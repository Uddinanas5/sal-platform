import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const clientName =
    typeof body.client_name === "string" ? body.client_name : "Unknown Client"

  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as string[]).filter(
        (u) => typeof u === "string" && u.length > 0
      )
    : []

  if (redirectUris.length === 0) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "At least one redirect_uri is required",
      },
      { status: 400 }
    )
  }

  // Validate every redirect_uri before it is ever stored or echoed back. Without
  // this, a `javascript:`/`data:` URI registers cleanly and later executes when
  // the authorize page redirects to it (XSS), and arbitrary `http://` targets
  // enable phishing / auth-code theft. This is the right gate for public Dynamic
  // Client Registration (RFC 7591) — the endpoint must stay unauthenticated for
  // MCP clients, so we harden the URIs instead of locking the route.
  const isProd = process.env.NODE_ENV === "production"
  for (const uri of redirectUris) {
    let parsed: URL
    try {
      parsed = new URL(uri)
    } catch {
      return NextResponse.json(
        { error: "invalid_redirect_uri", error_description: `Malformed redirect_uri: ${uri}` },
        { status: 400 }
      )
    }
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
    const schemeOk =
      parsed.protocol === "https:" || (parsed.protocol === "http:" && (!isProd || isLocalhost))
    if (!schemeOk) {
      return NextResponse.json(
        {
          error: "invalid_redirect_uri",
          error_description: `redirect_uri must use https (got "${parsed.protocol}"): ${uri}`,
        },
        { status: 400 }
      )
    }
  }

  const grantTypes = Array.isArray(body.grant_types)
    ? (body.grant_types as string[])
    : ["authorization_code"]

  const responseTypes = Array.isArray(body.response_types)
    ? (body.response_types as string[])
    : ["code"]

  const scope = typeof body.scope === "string" ? body.scope : "mcp"

  const clientId = crypto.randomBytes(32).toString("hex")

  await prisma.oAuthClient.create({
    data: {
      clientId,
      clientName,
      redirectUris,
      grantTypes,
      responseTypes,
      scope,
    },
  })

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: responseTypes,
      scope,
      token_endpoint_auth_method: "none",
    },
    { status: 201 }
  )
}
