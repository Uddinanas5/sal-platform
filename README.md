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
│   └── schema.prisma       # Database schema
├── src/
│   ├── api/                # API route examples
│   ├── lib/                # Shared utilities
│   └── types/              # TypeScript types
├── docs/
│   ├── DATABASE_SCHEMA.md  # Detailed schema documentation
│   └── API_ARCHITECTURE.md # API endpoint documentation
├── .env.example            # Environment variables template
└── README.md               # This file
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

## API Endpoints Summary

### Authentication
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### Businesses
- `POST /api/v1/businesses`
- `GET /api/v1/businesses/:id`
- `PATCH /api/v1/businesses/:id`

### Locations
- `POST /api/v1/businesses/:id/locations`
- `GET /api/v1/locations/:id`

### Staff
- `POST /api/v1/businesses/:id/staff`
- `GET /api/v1/staff/:id/availability`
- `PUT /api/v1/staff/:id/schedule`

### Services
- `POST /api/v1/businesses/:id/services`
- `GET /api/v1/services/:id`

### Clients
- `POST /api/v1/businesses/:id/clients`
- `GET /api/v1/clients/:id`

### Appointments
- `POST /api/v1/businesses/:id/appointments`
- `GET /api/v1/appointments/:id`
- `POST /api/v1/appointments/:id/confirm`
- `POST /api/v1/appointments/:id/complete`

### Public Booking
- `GET /api/v1/booking/:slug/availability`
- `POST /api/v1/booking/:slug/book`

See `docs/API_ARCHITECTURE.md` for complete API documentation.

## Security

### Row Level Security (RLS)

All tables use Supabase RLS policies:
- Users can only access their own data
- Staff can access their business's data
- Owners have full access to their business

### Authentication

- JWT-based authentication via Supabase
- Token refresh handling
- Multi-tenant isolation

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
