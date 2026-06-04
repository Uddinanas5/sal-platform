import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { withV1Auth } from "@/lib/api/auth"
import { createMcpServer } from "@/lib/mcp/create-server"

async function handleMcp(req: Request): Promise<Response> {
  // Beta gate: the MCP / developer-API surface is intentionally OFF. Its tool
  // layer is not yet tenant-hardened (it trusts caller-supplied prices and skips
  // ownership scoping on some foreign ids — see HANDOFF.md / the adversarial
  // pass), and the launch plan keeps API/MCP hidden until we deliberately ship
  // developer integrations. Set MCP_ENABLED=true only after the tools are hardened.
  if (process.env.MCP_ENABLED !== "true") {
    return new Response(
      JSON.stringify({ error: { code: "NOT_FOUND", message: "MCP API is not enabled." } }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    )
  }

  const ctx = await withV1Auth(req)
  if (!ctx) {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const resourceMetadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`
    return new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl}"`,
        },
      }
    )
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode for serverless
  })

  const server = createMcpServer(ctx)
  await server.connect(transport)
  return transport.handleRequest(req)
}

export const GET = handleMcp
export const POST = handleMcp
export const DELETE = handleMcp
