# SAL Platform - Architecture Overview

## Executive Summary

SAL is a comprehensive salon and barbershop management platform designed to compete with Fresha. It provides end-to-end business management including online booking, staff scheduling, payments, inventory, and client management.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│   Web App       │   Mobile App    │  Booking Widget │   Admin Portal    │
│   (Next.js)     │   (React Native)│   (Embeddable)  │   (Dashboard)     │
└────────┬────────┴────────┬────────┴────────┬────────┴─────────┬─────────┘
         │                 │                 │                   │
         └─────────────────┴─────────────────┴───────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                      │
│                     (Next.js API Routes)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Auth  │ Businesses │ Appointments │ Payments │ Inventory │ Notifications│
└────────┴────────────┴──────────────┴──────────┴───────────┴─────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────────┐ ┌──────────┐ ┌───────────────┐
            │   Supabase    │ │  Stripe  │ │    Twilio     │
            │  (PostgreSQL) │ │(Payments)│ │  (SMS/Voice)  │
            │   + Auth      │ │          │ │               │
            └───────────────┘ └──────────┘ └───────────────┘
```

## Core Modules

### 1. Business Management
- Multi-tenant architecture
- Multiple locations per business
- Customizable business hours
- Branding and settings
- Subscription management

### 2. User & Auth
- Role-based access (Owner, Admin, Staff, Client)
- Supabase Auth integration
- OAuth providers (Google, Apple)
- Email/phone verification

### 3. Staff Management
- Employee profiles with bios
- Work schedules with breaks
- Time off requests/approvals
- Multi-location assignments
- Commission tracking

### 4. Services
- Hierarchical categories
- Flexible pricing (fixed, variable, starting at)
- Duration and buffer times
- Service variations
- Online booking controls

### 5. Clients
- Customer profiles
- Visit history
- Preferences (staff, location)
- Loyalty points
- Marketing consent

### 6. Appointments
- Multi-service bookings
- Real-time availability engine
- Status workflow (pending → confirmed → checked-in → completed)
- Reminders and confirmations
- Rescheduling and cancellation

### 7. Payments
- Multiple payment methods
- Deposits and tips
- Gift cards
- Invoicing
- Refunds

### 8. Inventory
- Product management
- Stock tracking per location
- Low stock alerts
- Inventory transfers

### 9. Commissions
- Service commissions
- Product commissions
- Tip tracking
- Payroll periods

### 10. Notifications
- Email (Resend)
- SMS (Twilio)
- Push notifications
- Customizable templates

### 11. Reviews
- Client reviews
- Staff ratings
- Business responses

## Data Model Summary

### Entity Count: 35+ tables

| Category | Tables |
|----------|--------|
| Users & Auth | 1 |
| Business | 3 |
| Staff | 6 |
| Services | 4 |
| Clients | 1 |
| Appointments | 3 |
| Payments | 3 |
| Products | 4 |
| Commissions | 2 |
| Notifications | 2 |
| Reviews | 1 |
| Discounts | 1 |
| Audit | 1 |

### Key Relationships

```
Business (1) ─── (N) Location
Business (1) ─── (N) Staff
Business (1) ─── (N) Service
Business (1) ─── (N) Client
Business (1) ─── (N) Product

Location (1) ─── (N) Appointment
Location (1) ─── (N) Staff (via StaffLocation)

Staff (N) ─── (N) Service (via StaffService)
Staff (1) ─── (N) StaffSchedule
Staff (1) ─── (N) Commission

Appointment (1) ─── (N) AppointmentService
Appointment (1) ─── (N) AppointmentProduct
Appointment (1) ─── (N) Payment

Product (1) ─── (N) ProductInventory (per location)
```

## API Design

### Principles
- RESTful design
- Consistent response format
- JWT authentication (Supabase)
- Business-scoped operations
- Pagination for lists
- Soft deletes

### Endpoint Categories

| Category | Count | Example |
|----------|-------|---------|
| Auth | 6 | POST /auth/login |
| Users | 4 | GET /users/me |
| Businesses | 5 | POST /businesses |
| Locations | 6 | PUT /locations/:id/hours |
| Staff | 12 | GET /staff/:id/availability |
| Services | 8 | POST /services |
| Clients | 10 | GET /clients/:id/appointments |
| Appointments | 12 | POST /appointments/:id/complete |
| Booking (Public) | 5 | GET /booking/:slug/availability |
| Payments | 5 | POST /payments/:id/refund |
| Products | 6 | PATCH /products/:id |
| Inventory | 5 | POST /inventory/transfer |
| Reports | 7 | GET /reports/revenue |

**Total: ~90 endpoints**

## Security

### Authentication
- JWT-based via Supabase Auth
- Token refresh handling
- Session management

### Authorization
- Row Level Security (RLS)
- Business-level isolation
- Role-based permissions

### Data Protection
- Soft deletes
- Audit logging
- Input validation
- SQL injection prevention (Prisma)

## Scalability Considerations

### Database
- Connection pooling (PgBouncer)
- Indexed queries
- Partitioning for large tables (appointments, audit logs)

### API
- Stateless design
- Rate limiting
- Caching (Redis for sessions)
- CDN for static assets

### Future Scaling
- Read replicas
- Queue-based processing
- Microservices extraction

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript |
| Backend | Next.js API Routes |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Auth | Supabase Auth |
| Payments | Stripe |
| Email | Resend |
| SMS | Twilio |
| Storage | Supabase Storage |
| Hosting | Vercel |

## Development Workflow

1. **Schema Changes**: Modify `prisma/schema.prisma`
2. **Migrations**: `prisma migrate dev`
3. **Type Generation**: `prisma generate`
4. **API Development**: Create/modify routes in `src/api`
5. **Testing**: Unit + Integration tests
6. **Deployment**: Vercel auto-deploy

## File Structure

```
sal-platform/
├── prisma/
│   └── schema.prisma         # Database schema (35+ models)
├── src/
│   ├── api/                   # API routes
│   │   ├── auth/
│   │   ├── businesses/
│   │   ├── appointments/
│   │   ├── booking/
│   │   └── ...
│   ├── lib/                   # Shared utilities
│   │   ├── prisma.ts
│   │   ├── supabase.ts
│   │   └── api-utils.ts
│   └── types/                 # TypeScript types
│       └── index.ts
├── docs/
│   ├── DATABASE_SCHEMA.md     # Detailed schema docs
│   ├── API_ARCHITECTURE.md    # API endpoint docs
│   └── OVERVIEW.md            # This file
├── .env.example
└── README.md
```

## Supabase Configuration

```
Project URL: https://xucjxwemgdwrymsdfkzn.supabase.co
Database: PostgreSQL 15
Region: US East
```

## Next Steps

1. **Phase 1**: Core MVP
   - Business registration
   - Staff management
   - Service catalog
   - Basic booking
   - Payment processing

2. **Phase 2**: Enhanced Features
   - Client portal
   - Reviews
   - Loyalty program
   - Reports

3. **Phase 3**: Scale
   - Mobile apps
   - Marketplace
   - API for integrations
   - White-label

---

*Last updated: February 2026*
