import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { withV1Auth } from "@/lib/api/auth"
import { createMcpServer } from "@/lib/mcp/create-server"

async function handleMcp(req: Request): Promise<Response> {
  const ctx = await withV1Auth(req)
  if (!ctx) {
    return new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required. Provide a Bearer API key." } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
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
