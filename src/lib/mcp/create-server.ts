import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ApiContext } from "@/lib/api/auth"
import { registerClientTools } from "./tools/clients"
import { registerAppointmentTools } from "./tools/appointments"
import { registerServiceTools } from "./tools/services"
import { registerStaffTools } from "./tools/staff"
import { registerProductTools } from "./tools/products"
import { registerCheckoutTools } from "./tools/checkout"
import { registerMarketingTools } from "./tools/marketing"
import { registerMembershipTools } from "./tools/memberships"
import { registerReviewTools } from "./tools/reviews"
import { registerResourceTools } from "./tools/resources"
import { registerFormTools } from "./tools/forms"
import { registerWaitlistTools } from "./tools/waitlist"
import { registerTeamTools } from "./tools/team"
import { registerSettingsTools } from "./tools/settings"
import { registerApiKeyTools } from "./tools/api-keys"
import { registerMcpResources } from "./resources"

export function createMcpServer(ctx: ApiContext): McpServer {
  const server = new McpServer({
    name: "SAL Platform",
    version: "1.0.0",
  })

  // Register all tools
  registerClientTools(server, ctx)
  registerAppointmentTools(server, ctx)
  registerServiceTools(server, ctx)
  registerStaffTools(server, ctx)
  registerProductTools(server, ctx)
  registerCheckoutTools(server, ctx)
  registerMarketingTools(server, ctx)
  registerMembershipTools(server, ctx)
  registerReviewTools(server, ctx)
  registerResourceTools(server, ctx)
  registerFormTools(server, ctx)
  registerWaitlistTools(server, ctx)
  registerTeamTools(server, ctx)
  registerSettingsTools(server, ctx)
  registerApiKeyTools(server, ctx)

  // Register all resources (read-only data)
  registerMcpResources(server, ctx)

  return server
}
