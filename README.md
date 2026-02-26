# SAL - Salon & Barbershop Management Platform

A comprehensive Fresha competitor for managing salons, barbershops, and beauty businesses.

## Tech Stack

- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma
- **Backend**: Next.js API Routes
- **Auth**: Supabase Auth
- **Payments**: Stripe
- **Email**: Resend
- **SMS**: Twilio

## Project Structure

```
sal-platform/
├── prisma/
│   └── schema.prisma              # Database schema
├── src/
│   ├── app/
│   │   ├── (dashboard)/           # Protected dashboard routes
│   │   ├── api/v1/               # REST API v1 endpoints
│   │   ├── api/mcp/              # MCP server endpoint
│   │   └── book/                 # Public booking widget
│   ├── lib/
│   │   ├── actions/              # Server actions (mutations)
│   │   ├── queries/              # Data fetching (reads)
│   │   ├── api/                  # API auth + response helpers
│   │   └── mcp/                  # MCP server (tools + resources)
│   └── components/               # UI components
├── docs/
│   ├── DATABASE_SCHEMA.md         # Schema documentation
│   ├── API_ARCHITECTURE.md        # REST API documentation
│   └── MCP_SERVER.md             # MCP server documentation
├── .env.example                   # Environment variables template
└── README.md                      # This file
```

## Getting Started

### 1. Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account

### 2. Installation

```bash
# Clone and install
cd sal-platform
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your values
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm prisma generate

# Push schema to database
pnpm prisma db push

# Or create migrations (recommended for production)
pnpm prisma migrate dev --name init
```

### 4. Development

```bash
pnpm dev
```

## Core Features

### Business Management
- Multi-location support
- Business hours configuration
- Subscription tiers (Free, Starter, Pro, Enterprise)
- Business settings & branding

### Staff Management
- Staff profiles with bios & specializations
- Work schedules with breaks
- Time off requests & approvals
- Commission tracking
- Service assignments

### Services
- Service categories
- Price variations (fixed, starting at, variable)
- Duration & buffer times
- Deposits
- Online booking settings

### Clients
- Client profiles & history
- Tags & notes
- Preferred staff/location
- Loyalty points
- Marketing consent

### Appointments
- Multi-service bookings
- Real-time availability
- Booking confirmations & reminders
- Check-in workflow
- Rescheduling & cancellation

### Payments
- Multiple payment methods
- Deposits & tips
- Invoicing
- Gift cards
- Refunds

### Inventory
- Product management
- Stock tracking per location
- Low stock alerts
- Inventory transfers

### Commissions & Payroll
- Service commissions
- Product commissions
- Tips tracking
- Payroll periods

### Notifications
- Email notifications
- SMS notifications
- Push notifications
- Customizable templates

### Reviews
- Client reviews & ratings
- Staff reviews
- Business responses
- Public/private visibility

## Database Schema Overview

### Core Entities

| Entity | Description |
|--------|-------------|
| User | Authentication & profile |
| Business | Salon/shop organization |
| Location | Physical locations |
| Staff | Team members |
| Service | Services offered |
| Client | Customer profiles |
| Appointment | Bookings |
| Payment | Transactions |
| Product | Retail items |

### Relationships

```
Business (1) → (N) Locations
Business (1) → (N) Staff
Business (1) → (N) Services
Business (1) → (N) Clients
Location (1) → (N) Appointments
Staff (N) ←→ (N) Services (via StaffService)
Staff (N) ←→ (N) Locations (via StaffLocation)
Appointment (1) → (N) AppointmentServices
Appointment (1) → (N) Payments
```

## API

### REST API v1

Full CRUD REST API under `/api/v1/` with Bearer API key or session cookie authentication. 55+ endpoints covering all platform operations.

| Domain | Endpoints | Min Role |
|--------|-----------|----------|
| Clients | GET, POST, PATCH, DELETE | staff |
| Appointments | CRUD + recurring + groups | staff |
| Services | CRUD + toggle | admin |
| Staff | CRUD + schedule + time-off | staff/admin |
| Products | CRUD + adjust-stock | admin |
| Checkout | POST | staff |
| Marketing | Campaigns, deals, automated messages | admin |
| Memberships | Plans CRUD + subscriptions | admin/staff |
| Reviews | List + respond | admin |
| Resources | CRUD | admin |
| Forms | CRUD + submit | admin/staff |
| Waitlist | CRUD + notify + book | admin/staff |
| Team | Members + invitations | admin/owner |
| Settings | GET + PATCH | admin |
| API Keys | CRUD | owner |

See `docs/API_ARCHITECTURE.md` for complete endpoint documentation.

### MCP Server (AI Integration)

The platform exposes a [Model Context Protocol](https://modelcontextprotocol.io) server at `/api/mcp`, allowing AI assistants to manage your business programmatically.

**Supported clients:** Claude Desktop, Cursor, Windsurf, Cline, and any MCP-compatible tool.

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

57 tools and 14 resources covering clients, appointments, services, staff, products, checkout, marketing, memberships, reviews, resources, forms, waitlist, team management, settings, and API keys.

See `docs/MCP_SERVER.md` for full MCP documentation.

## Security

### Multi-Tenant Isolation

All data access is scoped by `businessId`. Server actions use `getBusinessContext()` and API routes use `withV1Auth()` to enforce tenant boundaries. No cross-business data leakage is possible.

### Authentication

- **Web UI:** NextAuth.js 5 with JWT sessions (credentials provider)
- **REST API / MCP:** Bearer API key (`sal_<hex>`) or session cookie
- API keys are SHA-256 hashed at rest; raw key shown once on creation
- Role-based access control: owner > admin > staff

## Environment Variables

See `.env.example` for all required variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection (pooled)
- `DIRECT_URL` - PostgreSQL connection (direct)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm prisma generate  # Generate Prisma client
pnpm prisma db push   # Push schema to database
pnpm prisma studio    # Open Prisma Studio
pnpm prisma migrate   # Create migration

# Linting & Types
pnpm lint             # Run ESLint
pnpm type-check       # Run TypeScript check
```

## Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Add environment variables
3. Deploy

### Self-hosted

1. Build: `pnpm build`
2. Start: `pnpm start`
3. Use PM2 or similar for process management

## License

Proprietary - All rights reserved.

## Support

For questions or issues, contact the development team.
