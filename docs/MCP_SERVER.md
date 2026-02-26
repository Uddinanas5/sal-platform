# SAL Platform — MCP Server

## Overview

The SAL Platform exposes a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server at `/api/mcp`. This allows AI assistants (Claude Desktop, Cursor, Windsurf, Cline, etc.) to manage your salon/spa business programmatically — creating appointments, managing clients, running marketing campaigns, and more — all through natural language.

**Transport:** Streamable HTTP (stateless mode, serverless-compatible)
**SDK:** `@modelcontextprotocol/sdk` v1.27.1
**Auth:** Bearer API key or session cookie (same as REST API v1)

---

## Quick Start

### 1. Generate an API Key

Create an API key through the SAL Platform dashboard (Settings > API Keys) or via the REST API:

```bash
curl -X POST https://your-domain.com/api/v1/api-keys \
  -H "Authorization: Bearer <existing-key-or-session>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Claude Desktop", "role": "admin"}'
```

Save the returned `key` value (format: `sal_<hex>`). It is only shown once.

### 2. Configure Your AI Tool

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "sal-platform": {
      "url": "https://your-domain.com/api/mcp",
      "headers": {
        "Authorization": "Bearer sal_your_api_key_here"
      }
    }
  }
}
```

#### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "sal-platform": {
      "url": "https://your-domain.com/api/mcp",
      "headers": {
        "Authorization": "Bearer sal_your_api_key_here"
      }
    }
  }
}
```

#### Windsurf

Add to your Windsurf MCP settings:

```json
{
  "mcpServers": {
    "sal-platform": {
      "serverUrl": "https://your-domain.com/api/mcp",
      "headers": {
        "Authorization": "Bearer sal_your_api_key_here"
      }
    }
  }
}
```

#### Local Development

When running `pnpm dev`, use:

```json
{
  "url": "http://localhost:3000/api/mcp",
  "headers": {
    "Authorization": "Bearer sal_your_api_key_here"
  }
}
```

---

## Authentication

The MCP server reuses the same auth system as the REST API:

- **API Key (recommended for MCP):** `Authorization: Bearer sal_<hex>`
- **Session Cookie:** Automatically used if the user is logged in via the web UI

API keys are scoped to a business and carry a role (`admin` or `owner`). The role determines which tools are accessible — staff-level tools are available to all roles, while admin/owner tools enforce minimum role requirements.

---

## Tools Reference

Tools are MCP's mechanism for mutations (create, update, delete). Each tool accepts typed parameters and returns JSON results.

### Clients (5 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-clients` | Search/paginate clients by name, email, phone | staff |
| `get-client` | Get client details with recent appointment history | staff |
| `create-client` | Create a new client record | staff |
| `update-client` | Update client info (name, email, phone, notes, tags) | staff |
| `delete-client` | Delete a client | admin |

### Appointments (11 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-appointments` | List with filters: date range, staff, client, status | staff* |
| `create-appointment` | Book a client for a service with a staff member | staff |
| `update-appointment-status` | Set status: confirmed, checked_in, in_progress, completed, cancelled, no_show | staff |
| `reschedule-appointment` | Move to a new time, optionally reassign staff | staff |
| `cancel-appointment` | Cancel with optional reason | staff |
| `create-recurring-appointment` | Create weekly/biweekly/monthly series (up to 52) | staff |
| `cancel-recurring-series` | Cancel all future appointments in a series | staff |
| `create-group-appointment` | Create a group class/session with max participants | staff |
| `add-group-participant` | Add a client to a group appointment | staff |
| `remove-group-participant` | Remove a client from a group appointment | staff |

*Staff role users automatically see only their own appointments.

### Services (5 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-services` | List services, optionally filter active only | staff |
| `create-service` | Create with name, duration, price, category, color | admin |
| `update-service` | Update service details | admin |
| `delete-service` | Remove a service | admin |
| `toggle-service` | Toggle active/inactive status | admin |

### Staff (6 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-staff` | List active staff with their services | staff |
| `get-staff-member` | Full details: schedule, services, upcoming time off | staff |
| `create-staff` | Create a new staff account with service assignments | admin |
| `delete-staff` | Deactivate a staff member | admin |
| `update-staff-schedule` | Set weekly work schedule (day, start/end, working flag) | admin |
| `request-time-off` | Request time off (vacation, sick, personal, other) | staff |

### Products & Inventory (4 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-products` | List with category filter and pagination | admin |
| `create-product` | Create product with pricing, SKU, initial stock | admin |
| `delete-product` | Soft-delete a product | admin |
| `adjust-stock` | Adjust stock quantity with audit trail | admin |

### Checkout (1 tool)

| Tool | Description | Min Role |
|------|-------------|----------|
| `process-checkout` | Full payment: items, discount, tax, tip, loyalty points | staff |

### Marketing (10 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-campaigns` | List all campaigns | admin |
| `create-campaign` | Create email/SMS/both campaign | admin |
| `update-campaign` | Edit campaign content | admin |
| `delete-campaign` | Remove a campaign | admin |
| `send-campaign` | Launch a campaign | admin |
| `list-deals` | List promotional deals | admin |
| `create-deal` | Create a deal with discount type/value and validity dates | admin |
| `delete-deal` | Remove a deal | admin |
| `list-automated-messages` | List automated message rules | admin |
| `create-automated-message` | Create triggered message (booking confirmation, reminder, birthday, etc.) | admin |
| `toggle-automated-message` | Enable/disable a message rule | admin |
| `delete-automated-message` | Remove a message rule | admin |

### Memberships (7 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-membership-plans` | List all plans | admin |
| `create-membership-plan` | Create plan with pricing, billing cycle, sessions, discount | admin |
| `update-membership-plan` | Edit plan details | admin |
| `delete-membership-plan` | Remove a plan | admin |
| `list-memberships` | List client subscriptions | admin |
| `create-membership` | Enroll a client in a plan | staff |
| `update-membership` | Cancel, pause, or resume a subscription | admin |

### Reviews (2 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-reviews` | List with status/rating filters and pagination | admin |
| `respond-to-review` | Post a business response | admin |

### Resources (4 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-resources` | List rooms, equipment, etc. | admin |
| `create-resource` | Create a bookable resource with type and capacity | admin |
| `update-resource` | Edit resource details | admin |
| `delete-resource` | Remove a resource | admin |

### Forms (5 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-forms` | List form templates | admin |
| `create-form` | Create form with typed fields (text, checkbox, select, etc.) | admin |
| `update-form` | Edit form metadata | admin |
| `delete-form` | Remove a form template | admin |
| `submit-form` | Submit a completed form for a client | staff |

### Waitlist (5 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-waitlist` | List current waitlist entries | admin |
| `add-to-waitlist` | Add client with preferred date/time/service/staff | staff |
| `remove-from-waitlist` | Remove (cancel) a waitlist entry | staff |
| `notify-waitlist-client` | Mark entry as notified | admin |
| `book-from-waitlist` | Convert waitlist entry to a booked appointment | staff |

### Team (6 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-team` | List active team members | admin |
| `remove-team-member` | Deactivate a team member | admin |
| `update-team-member-role` | Change role (staff/admin/owner) | owner |
| `list-invitations` | List pending invitations | admin |
| `invite-team-member` | Send email invitation with JWT token | admin |
| `revoke-invitation` | Revoke a pending invitation | admin |

### Settings (2 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `get-settings` | Get business profile, locations, and hours | admin |
| `update-settings` | Update name, phone, email, website, timezone, etc. | admin |

### API Keys (3 tools)

| Tool | Description | Min Role |
|------|-------------|----------|
| `list-api-keys` | List active keys (prefix only, no hashes) | owner |
| `create-api-key` | Generate new key (raw key returned once) | owner |
| `revoke-api-key` | Permanently revoke a key | owner |

---

## Resources Reference

Resources are MCP's mechanism for read-only data. Each resource has a URI and returns JSON.

| Resource | URI | Description | Min Role |
|----------|-----|-------------|----------|
| Clients | `sal://clients` | All clients (up to 200) | staff |
| Appointments | `sal://appointments` | Last 30 days of appointments | staff |
| Services | `sal://services` | Active services with categories | staff |
| Staff | `sal://staff` | Active staff with services | staff |
| Products | `sal://products` | All products with categories | admin |
| Campaigns | `sal://marketing/campaigns` | Marketing campaigns | admin |
| Deals | `sal://marketing/deals` | Promotional deals | admin |
| Membership Plans | `sal://memberships/plans` | Available plans | admin |
| Memberships | `sal://memberships` | Client subscriptions | admin |
| Reviews | `sal://reviews` | Recent reviews (up to 100) | admin |
| Resources | `sal://resources` | Bookable rooms/equipment | admin |
| Forms | `sal://forms` | Form templates | admin |
| Waitlist | `sal://waitlist` | Current waitlist | admin |
| Settings | `sal://settings` | Business profile and hours | admin |

---

## Architecture

### Request Flow

```
AI Client (Claude Desktop, Cursor, etc.)
    │
    ├── POST /api/mcp  (tool calls, initialize)
    ├── GET  /api/mcp   (SSE for server messages)
    └── DELETE /api/mcp  (session cleanup)
    │
    ▼
src/app/api/mcp/route.ts
    │
    ├── withV1Auth(req)  →  { userId, businessId, role }
    │
    ├── WebStandardStreamableHTTPServerTransport (stateless)
    │
    └── createMcpServer(ctx)  →  McpServer with all tools + resources
         │
         ├── src/lib/mcp/tools/*.ts  (57 tools in 15 files)
         └── src/lib/mcp/resources.ts (14 resources)
              │
              └── Prisma queries scoped by ctx.businessId
```

### Key Design Decisions

- **Stateless mode** (`sessionIdGenerator: undefined`): Each HTTP request creates a fresh server instance. No session state is persisted between requests. This is correct for serverless (Vercel, etc.).
- **Per-request server instantiation**: The `ctx` from `withV1Auth()` is captured in a closure when tools are registered, ensuring every Prisma query is scoped to the authenticated business.
- **Direct Prisma calls**: Tools call Prisma directly (not the REST API), avoiding HTTP overhead while reusing the same data access patterns.
- **Role enforcement**: Each tool checks `ctx.role` against the minimum required role. Staff users have limited access; admin and owner users have broader access.

### File Structure

```
src/
├── app/api/mcp/
│   └── route.ts                  # POST/GET/DELETE handler
└── lib/mcp/
    ├── create-server.ts          # McpServer factory
    ├── resources.ts              # 14 read-only resources
    └── tools/
        ├── clients.ts            # 5 tools
        ├── appointments.ts       # 11 tools
        ├── services.ts           # 5 tools
        ├── staff.ts              # 6 tools
        ├── products.ts           # 4 tools
        ├── checkout.ts           # 1 tool
        ├── marketing.ts          # 12 tools
        ├── memberships.ts        # 7 tools
        ├── reviews.ts            # 2 tools
        ├── resources.ts          # 4 tools
        ├── forms.ts              # 5 tools
        ├── waitlist.ts           # 5 tools
        ├── team.ts               # 6 tools
        ├── settings.ts           # 2 tools
        └── api-keys.ts           # 3 tools
```

---

## Error Handling

Tool errors return `isError: true` with a JSON error message:

```json
{
  "content": [{ "type": "text", "text": "{\"error\": \"Client not found\"}" }],
  "isError": true
}
```

Common error messages:
- `"Insufficient permissions: admin or owner required"` — role too low
- `"Client not found"` / `"Service not found"` — entity doesn't exist in this business
- `"Time slot already booked for this staff member"` — scheduling conflict
- `"Business not configured"` — no location exists yet (run onboarding first)

Authentication failures return HTTP 401 before reaching the MCP layer:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required. Provide a Bearer API key." } }
```
