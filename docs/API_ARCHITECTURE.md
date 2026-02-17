# SAL API Architecture

## Overview

SAL uses RESTful API design principles with Next.js API routes. All endpoints follow consistent patterns for authentication, error handling, and response formats.

## Base URL

```
Production: https://sal.app/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

### Headers

```
Authorization: Bearer <supabase_access_token>
X-Business-ID: <business_uuid>  (required for business-scoped endpoints)
X-Location-ID: <location_uuid>  (optional, for location-scoped operations)
```

### Auth Flow

1. Client authenticates with Supabase Auth
2. Receives JWT access token
3. Token included in all API requests
4. Backend validates token and extracts user

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or missing auth token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid input data |
| CONFLICT | 409 | Resource conflict (e.g., duplicate) |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## API Endpoints

### Auth Endpoints

#### POST /api/v1/auth/register
Register a new user account.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "role": "owner"
}
```

#### POST /api/v1/auth/login
Login with email/password.

#### POST /api/v1/auth/logout
Logout current session.

#### POST /api/v1/auth/refresh
Refresh access token.

#### POST /api/v1/auth/forgot-password
Request password reset.

#### POST /api/v1/auth/reset-password
Reset password with token.

#### GET /api/v1/auth/me
Get current user profile.

---

### User Endpoints

#### GET /api/v1/users/me
Get current user profile with all details.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "owner",
  "businesses": [...],
  "staffProfiles": [...]
}
```

#### PATCH /api/v1/users/me
Update current user profile.

#### PUT /api/v1/users/me/avatar
Upload profile avatar.

#### PUT /api/v1/users/me/notifications
Update notification preferences.

---

### Business Endpoints

#### POST /api/v1/businesses
Create a new business.

**Body:**
```json
{
  "name": "Glamour Salon",
  "description": "Premium hair salon",
  "email": "info@glamoursalon.com",
  "phone": "+1234567890",
  "website": "https://glamoursalon.com",
  "currency": "USD",
  "timezone": "America/New_York"
}
```

#### GET /api/v1/businesses
List user's businesses.

#### GET /api/v1/businesses/:id
Get business details.

#### PATCH /api/v1/businesses/:id
Update business.

#### DELETE /api/v1/businesses/:id
Delete business (soft delete).

#### GET /api/v1/businesses/:id/stats
Get business statistics dashboard.

**Response:**
```json
{
  "revenue": {
    "today": 1250.00,
    "thisWeek": 8500.00,
    "thisMonth": 32000.00,
    "growth": 12.5
  },
  "appointments": {
    "today": 15,
    "upcoming": 45,
    "completedThisMonth": 280
  },
  "clients": {
    "total": 450,
    "newThisMonth": 35
  }
}
```

---

### Location Endpoints

#### POST /api/v1/businesses/:businessId/locations
Create a new location.

**Body:**
```json
{
  "name": "Downtown Branch",
  "addressLine1": "123 Main St",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "US",
  "phone": "+1234567890",
  "isPrimary": false
}
```

#### GET /api/v1/businesses/:businessId/locations
List all locations.

#### GET /api/v1/locations/:id
Get location details.

#### PATCH /api/v1/locations/:id
Update location.

#### DELETE /api/v1/locations/:id
Delete location.

#### GET /api/v1/locations/:id/hours
Get business hours.

#### PUT /api/v1/locations/:id/hours
Update business hours.

**Body:**
```json
{
  "hours": [
    { "dayOfWeek": 0, "isClosed": true },
    { "dayOfWeek": 1, "openTime": "09:00", "closeTime": "18:00" },
    { "dayOfWeek": 2, "openTime": "09:00", "closeTime": "18:00" },
    ...
  ]
}
```

---

### Staff Endpoints

#### POST /api/v1/businesses/:businessId/staff
Add new staff member.

**Body:**
```json
{
  "email": "staff@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "title": "Senior Stylist",
  "locationId": "uuid",
  "commissionRate": 40,
  "employmentType": "full_time",
  "sendInvite": true
}
```

#### GET /api/v1/businesses/:businessId/staff
List all staff.

**Query params:**
- `locationId` - Filter by location
- `isActive` - Filter by status
- `canAcceptBookings` - Filter by booking availability

#### GET /api/v1/staff/:id
Get staff details.

#### PATCH /api/v1/staff/:id
Update staff.

#### DELETE /api/v1/staff/:id
Remove staff member.

#### GET /api/v1/staff/:id/schedule
Get staff schedule.

#### PUT /api/v1/staff/:id/schedule
Update staff schedule.

**Body:**
```json
{
  "locationId": "uuid",
  "schedules": [
    {
      "dayOfWeek": 1,
      "isWorking": true,
      "startTime": "09:00",
      "endTime": "17:00",
      "breaks": [
        { "startTime": "12:00", "endTime": "13:00" }
      ]
    }
  ]
}
```

#### GET /api/v1/staff/:id/services
Get services staff can perform.

#### PUT /api/v1/staff/:id/services
Assign services to staff.

#### GET /api/v1/staff/:id/availability
Get staff availability for date range.

**Query params:**
- `startDate` - Start date (YYYY-MM-DD)
- `endDate` - End date (YYYY-MM-DD)
- `serviceId` - Optional service filter

**Response:**
```json
{
  "availability": [
    {
      "date": "2024-01-15",
      "slots": [
        { "start": "09:00", "end": "09:30", "available": true },
        { "start": "09:30", "end": "10:00", "available": false }
      ]
    }
  ]
}
```

#### POST /api/v1/staff/:id/time-off
Request time off.

#### GET /api/v1/staff/:id/time-off
List time off requests.

#### PATCH /api/v1/staff/:id/time-off/:timeOffId
Update/approve/reject time off.

---

### Service Endpoints

#### POST /api/v1/businesses/:businessId/service-categories
Create service category.

#### GET /api/v1/businesses/:businessId/service-categories
List service categories.

#### PATCH /api/v1/service-categories/:id
Update category.

#### DELETE /api/v1/service-categories/:id
Delete category.

#### POST /api/v1/businesses/:businessId/services
Create service.

**Body:**
```json
{
  "categoryId": "uuid",
  "name": "Haircut",
  "description": "Professional haircut with consultation",
  "durationMinutes": 45,
  "price": 50.00,
  "priceType": "fixed",
  "depositAmount": 10.00,
  "isOnlineBooking": true,
  "variations": [
    { "name": "Short Hair", "durationMinutes": 30, "price": 40.00 },
    { "name": "Long Hair", "durationMinutes": 60, "price": 65.00 }
  ]
}
```

#### GET /api/v1/businesses/:businessId/services
List all services.

**Query params:**
- `categoryId` - Filter by category
- `isActive` - Filter by status
- `isOnlineBooking` - Filter by online booking

#### GET /api/v1/services/:id
Get service details.

#### PATCH /api/v1/services/:id
Update service.

#### DELETE /api/v1/services/:id
Delete service.

---

### Client Endpoints

#### POST /api/v1/businesses/:businessId/clients
Create new client.

**Body:**
```json
{
  "email": "client@example.com",
  "phone": "+1234567890",
  "firstName": "Alice",
  "lastName": "Johnson",
  "dateOfBirth": "1990-05-15",
  "notes": "Prefers natural products",
  "tags": ["VIP", "Regular"],
  "marketingConsent": true
}
```

#### GET /api/v1/businesses/:businessId/clients
List/search clients.

**Query params:**
- `search` - Search by name/email/phone
- `tags` - Filter by tags
- `lastVisitAfter` - Filter by last visit date
- `minSpent` - Filter by minimum total spent
- `page`, `limit` - Pagination

#### GET /api/v1/clients/:id
Get client details.

#### PATCH /api/v1/clients/:id
Update client.

#### DELETE /api/v1/clients/:id
Delete client (soft delete).

#### GET /api/v1/clients/:id/appointments
Get client's appointment history.

#### GET /api/v1/clients/:id/payments
Get client's payment history.

#### POST /api/v1/clients/:id/notes
Add note to client.

#### POST /api/v1/clients/:id/block
Block client.

#### POST /api/v1/clients/:id/unblock
Unblock client.

#### POST /api/v1/businesses/:businessId/clients/import
Bulk import clients (CSV).

#### GET /api/v1/businesses/:businessId/clients/export
Export clients to CSV.

---

### Appointment Endpoints

#### POST /api/v1/businesses/:businessId/appointments
Create new appointment.

**Body:**
```json
{
  "locationId": "uuid",
  "clientId": "uuid",
  "startTime": "2024-01-15T10:00:00Z",
  "source": "online",
  "notes": "Client requested specific stylist",
  "services": [
    {
      "serviceId": "uuid",
      "variationId": "uuid",
      "staffId": "uuid"
    }
  ]
}
```

#### GET /api/v1/businesses/:businessId/appointments
List appointments.

**Query params:**
- `locationId` - Filter by location
- `staffId` - Filter by staff
- `clientId` - Filter by client
- `status` - Filter by status
- `startDate` - Start date range
- `endDate` - End date range
- `page`, `limit` - Pagination

#### GET /api/v1/appointments/:id
Get appointment details.

#### PATCH /api/v1/appointments/:id
Update appointment.

#### DELETE /api/v1/appointments/:id
Cancel appointment.

**Body:**
```json
{
  "cancellationReason": "Client requested cancellation"
}
```

#### POST /api/v1/appointments/:id/confirm
Confirm pending appointment.

#### POST /api/v1/appointments/:id/check-in
Check in client.

#### POST /api/v1/appointments/:id/start
Start appointment (in progress).

#### POST /api/v1/appointments/:id/complete
Complete appointment.

#### POST /api/v1/appointments/:id/no-show
Mark as no-show.

#### POST /api/v1/appointments/:id/reschedule
Reschedule appointment.

**Body:**
```json
{
  "newStartTime": "2024-01-16T14:00:00Z",
  "notifyClient": true
}
```

#### GET /api/v1/appointments/:id/receipt
Generate receipt/invoice.

#### POST /api/v1/appointments/:id/reminder
Send reminder to client.

---

### Booking (Public) Endpoints

These endpoints are for the public booking widget.

#### GET /api/v1/booking/:businessSlug
Get business booking page info.

#### GET /api/v1/booking/:businessSlug/locations
Get bookable locations.

#### GET /api/v1/booking/:businessSlug/services
Get bookable services.

#### GET /api/v1/booking/:businessSlug/staff
Get available staff.

#### GET /api/v1/booking/:businessSlug/availability
Get available time slots.

**Query params:**
- `locationId` - Location
- `serviceIds` - Service(s) to book
- `staffId` - Preferred staff (optional)
- `date` - Date to check

**Response:**
```json
{
  "date": "2024-01-15",
  "slots": [
    {
      "startTime": "09:00",
      "endTime": "09:45",
      "staffOptions": [
        { "staffId": "uuid", "name": "Jane Smith" }
      ]
    }
  ]
}
```

#### POST /api/v1/booking/:businessSlug/book
Create booking (public).

**Body:**
```json
{
  "locationId": "uuid",
  "startTime": "2024-01-15T09:00:00Z",
  "client": {
    "email": "newclient@example.com",
    "phone": "+1234567890",
    "firstName": "Bob",
    "lastName": "Wilson"
  },
  "services": [
    { "serviceId": "uuid", "staffId": "uuid" }
  ],
  "notes": "First time client"
}
```

#### GET /api/v1/booking/confirm/:token
Confirm booking via email link.

#### GET /api/v1/booking/cancel/:token
Cancel booking via email link.

---

### Payment Endpoints

#### POST /api/v1/appointments/:id/payments
Process payment for appointment.

**Body:**
```json
{
  "method": "card",
  "amount": 75.00,
  "tipAmount": 15.00,
  "processorToken": "tok_xxx"
}
```

#### GET /api/v1/businesses/:businessId/payments
List payments.

**Query params:**
- `startDate`, `endDate` - Date range
- `method` - Payment method
- `status` - Payment status

#### GET /api/v1/payments/:id
Get payment details.

#### POST /api/v1/payments/:id/refund
Process refund.

**Body:**
```json
{
  "amount": 25.00,
  "reason": "Service not completed"
}
```

#### GET /api/v1/payments/:id/receipt
Get payment receipt.

---

### Invoice Endpoints

#### POST /api/v1/businesses/:businessId/invoices
Create invoice.

#### GET /api/v1/businesses/:businessId/invoices
List invoices.

#### GET /api/v1/invoices/:id
Get invoice details.

#### PATCH /api/v1/invoices/:id
Update invoice.

#### POST /api/v1/invoices/:id/send
Send invoice to client.

#### POST /api/v1/invoices/:id/mark-paid
Mark invoice as paid.

#### GET /api/v1/invoices/:id/pdf
Download invoice PDF.

---

### Gift Card Endpoints

#### POST /api/v1/businesses/:businessId/gift-cards
Create gift card.

**Body:**
```json
{
  "value": 100.00,
  "recipientEmail": "friend@example.com",
  "recipientName": "Best Friend",
  "personalMessage": "Enjoy a spa day!",
  "expiresAt": "2025-01-15"
}
```

#### GET /api/v1/businesses/:businessId/gift-cards
List gift cards.

#### GET /api/v1/gift-cards/:id
Get gift card details.

#### GET /api/v1/gift-cards/lookup/:code
Lookup gift card by code.

#### POST /api/v1/gift-cards/:id/redeem
Redeem gift card.

**Body:**
```json
{
  "amount": 50.00,
  "appointmentId": "uuid"
}
```

---

### Product Endpoints

#### POST /api/v1/businesses/:businessId/product-categories
Create product category.

#### GET /api/v1/businesses/:businessId/product-categories
List product categories.

#### POST /api/v1/businesses/:businessId/products
Create product.

**Body:**
```json
{
  "categoryId": "uuid",
  "name": "Professional Shampoo",
  "description": "Salon-quality shampoo",
  "sku": "SHMP-001",
  "barcode": "123456789",
  "brand": "BrandName",
  "costPrice": 12.00,
  "retailPrice": 25.00,
  "isTaxable": true
}
```

#### GET /api/v1/businesses/:businessId/products
List products.

#### GET /api/v1/products/:id
Get product details.

#### PATCH /api/v1/products/:id
Update product.

#### DELETE /api/v1/products/:id
Delete product.

---

### Inventory Endpoints

#### GET /api/v1/locations/:locationId/inventory
Get inventory levels.

#### PATCH /api/v1/locations/:locationId/inventory/:productId
Update inventory.

**Body:**
```json
{
  "quantity": 50,
  "lowStockThreshold": 10
}
```

#### POST /api/v1/locations/:locationId/inventory/:productId/adjust
Adjust inventory.

**Body:**
```json
{
  "quantityChange": -5,
  "reason": "Damaged items",
  "notes": "Box was dropped during delivery"
}
```

#### POST /api/v1/locations/:locationId/inventory/transfer
Transfer inventory between locations.

**Body:**
```json
{
  "targetLocationId": "uuid",
  "items": [
    { "productId": "uuid", "quantity": 10 }
  ]
}
```

#### GET /api/v1/businesses/:businessId/inventory/low-stock
Get low stock alerts.

---

### Commission Endpoints

#### GET /api/v1/staff/:id/commissions
Get staff commissions.

**Query params:**
- `periodStart`, `periodEnd` - Date range
- `status` - Commission status

#### GET /api/v1/businesses/:businessId/commissions
Get all commissions.

#### POST /api/v1/businesses/:businessId/commissions/calculate
Calculate commissions for period.

#### POST /api/v1/businesses/:businessId/commissions/pay
Mark commissions as paid.

---

### Discount Endpoints

#### POST /api/v1/businesses/:businessId/discounts
Create discount.

**Body:**
```json
{
  "code": "SUMMER20",
  "name": "Summer Sale 20%",
  "type": "percentage",
  "value": 20,
  "appliesTo": "all",
  "usageLimit": 100,
  "validFrom": "2024-06-01",
  "validUntil": "2024-08-31"
}
```

#### GET /api/v1/businesses/:businessId/discounts
List discounts.

#### GET /api/v1/discounts/:id
Get discount details.

#### PATCH /api/v1/discounts/:id
Update discount.

#### DELETE /api/v1/discounts/:id
Delete discount.

#### POST /api/v1/discounts/validate
Validate discount code.

**Body:**
```json
{
  "businessId": "uuid",
  "code": "SUMMER20",
  "clientId": "uuid",
  "services": [...],
  "products": [...]
}
```

---

### Review Endpoints

#### GET /api/v1/businesses/:businessId/reviews
Get business reviews.

**Query params:**
- `locationId` - Filter by location
- `staffId` - Filter by staff
- `minRating` - Minimum rating
- `page`, `limit` - Pagination

#### GET /api/v1/reviews/:id
Get review details.

#### POST /api/v1/reviews/:id/respond
Respond to review.

**Body:**
```json
{
  "response": "Thank you for your feedback!"
}
```

#### POST /api/v1/appointments/:appointmentId/review
Submit review for appointment.

**Body:**
```json
{
  "overallRating": 5,
  "serviceRating": 5,
  "staffRating": 5,
  "comment": "Amazing experience!"
}
```

---

### Notification Endpoints

#### GET /api/v1/users/me/notifications
Get user notifications.

#### PATCH /api/v1/notifications/:id/read
Mark notification as read.

#### POST /api/v1/notifications/mark-all-read
Mark all notifications as read.

#### GET /api/v1/businesses/:businessId/notification-templates
Get notification templates.

#### PATCH /api/v1/notification-templates/:id
Update notification template.

---

### Reports Endpoints

#### GET /api/v1/businesses/:businessId/reports/revenue
Revenue report.

**Query params:**
- `startDate`, `endDate` - Date range
- `groupBy` - 'day', 'week', 'month'
- `locationId` - Filter by location

#### GET /api/v1/businesses/:businessId/reports/appointments
Appointments report.

#### GET /api/v1/businesses/:businessId/reports/staff-performance
Staff performance report.

#### GET /api/v1/businesses/:businessId/reports/services
Services performance report.

#### GET /api/v1/businesses/:businessId/reports/products
Products sales report.

#### GET /api/v1/businesses/:businessId/reports/clients
Client analytics report.

#### GET /api/v1/businesses/:businessId/reports/retention
Client retention report.

---

### Webhook Endpoints

#### POST /api/v1/webhooks/stripe
Stripe webhook handler.

#### POST /api/v1/webhooks/twilio
Twilio SMS webhook handler.

---

## Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| Auth endpoints | 10/min |
| Read endpoints | 100/min |
| Write endpoints | 30/min |
| Public booking | 50/min |
| Webhooks | Unlimited |

## Pagination

All list endpoints support pagination:

```
GET /api/v1/clients?page=2&limit=20
```

Response includes:
```json
{
  "meta": {
    "pagination": {
      "page": 2,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

## Filtering & Sorting

### Filtering

```
GET /api/v1/appointments?status=confirmed&startDate=2024-01-01
```

### Sorting

```
GET /api/v1/clients?sortBy=createdAt&sortOrder=desc
```

## Expanding Relations

Some endpoints support expanding related data:

```
GET /api/v1/appointments/:id?expand=client,services.staff
```

## Versioning

API version is included in URL path. Breaking changes will increment version number.

Current: `v1`

## CORS

CORS is configured for:
- Production: `https://sal.app`
- Development: `http://localhost:3000`
- Booking widgets: Configurable per business

## SDKs

Future: Official SDKs for:
- JavaScript/TypeScript
- React Native
- Swift (iOS)
- Kotlin (Android)
