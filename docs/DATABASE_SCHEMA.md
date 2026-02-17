# SAL Database Schema Design

## Overview

SAL is a comprehensive salon/barbershop management platform competing with Fresha. This document outlines the complete database schema designed for PostgreSQL via Supabase.

## Entity Relationship Diagram (Conceptual)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Business  │────<│  Location   │────<│    Staff    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Service   │────<│ Appointment │>────│  Schedule   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│   Product   │     │   Payment   │
└─────────────┘     └─────────────┘
```

## Core Tables

### 1. Users & Authentication

#### `users`
Central user table linked to Supabase Auth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| auth_id | UUID | UNIQUE, NOT NULL | Supabase Auth user ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email address |
| phone | VARCHAR(20) | NULL | Phone number |
| first_name | VARCHAR(100) | NOT NULL | First name |
| last_name | VARCHAR(100) | NOT NULL | Last name |
| avatar_url | TEXT | NULL | Profile picture URL |
| role | ENUM | NOT NULL | 'owner', 'admin', 'staff', 'client' |
| status | ENUM | DEFAULT 'active' | 'active', 'inactive', 'suspended' |
| email_verified | BOOLEAN | DEFAULT false | Email verification status |
| phone_verified | BOOLEAN | DEFAULT false | Phone verification status |
| notification_preferences | JSONB | DEFAULT '{}' | Notification settings |
| metadata | JSONB | DEFAULT '{}' | Additional user data |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete timestamp |

### 2. Business & Locations

#### `businesses`
Top-level business entity (salon/barbershop chain).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| owner_id | UUID | FK → users.id | Business owner |
| name | VARCHAR(255) | NOT NULL | Business name |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | URL-friendly identifier |
| description | TEXT | NULL | Business description |
| logo_url | TEXT | NULL | Logo image URL |
| cover_image_url | TEXT | NULL | Cover image URL |
| website | VARCHAR(255) | NULL | Website URL |
| email | VARCHAR(255) | NULL | Business email |
| phone | VARCHAR(20) | NULL | Business phone |
| currency | VARCHAR(3) | DEFAULT 'USD' | Currency code |
| timezone | VARCHAR(50) | DEFAULT 'UTC' | Timezone |
| subscription_tier | ENUM | DEFAULT 'free' | 'free', 'starter', 'pro', 'enterprise' |
| subscription_status | ENUM | DEFAULT 'active' | Subscription status |
| trial_ends_at | TIMESTAMPTZ | NULL | Trial end date |
| settings | JSONB | DEFAULT '{}' | Business settings |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete |

#### `locations`
Physical locations for a business.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Parent business |
| name | VARCHAR(255) | NOT NULL | Location name |
| slug | VARCHAR(100) | NOT NULL | URL-friendly identifier |
| address_line_1 | VARCHAR(255) | NOT NULL | Street address |
| address_line_2 | VARCHAR(255) | NULL | Suite, unit, etc. |
| city | VARCHAR(100) | NOT NULL | City |
| state | VARCHAR(100) | NULL | State/Province |
| postal_code | VARCHAR(20) | NULL | ZIP/Postal code |
| country | VARCHAR(2) | NOT NULL | ISO country code |
| latitude | DECIMAL(10,8) | NULL | GPS latitude |
| longitude | DECIMAL(11,8) | NULL | GPS longitude |
| phone | VARCHAR(20) | NULL | Location phone |
| email | VARCHAR(255) | NULL | Location email |
| is_primary | BOOLEAN | DEFAULT false | Primary location flag |
| is_active | BOOLEAN | DEFAULT true | Active status |
| settings | JSONB | DEFAULT '{}' | Location-specific settings |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete |

**Unique Constraint:** (business_id, slug)

#### `business_hours`
Operating hours for each location.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| location_id | UUID | FK → locations.id | Location reference |
| day_of_week | INT | NOT NULL (0-6) | 0=Sunday, 6=Saturday |
| open_time | TIME | NULL | Opening time |
| close_time | TIME | NULL | Closing time |
| is_closed | BOOLEAN | DEFAULT false | Closed on this day |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Unique Constraint:** (location_id, day_of_week)

### 3. Staff Management

#### `staff`
Staff members linked to locations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → users.id | Associated user account |
| location_id | UUID | FK → locations.id | Primary location |
| employee_id | VARCHAR(50) | NULL | Internal employee ID |
| title | VARCHAR(100) | NULL | Job title |
| bio | TEXT | NULL | Staff bio for booking page |
| specializations | TEXT[] | DEFAULT '{}' | List of specializations |
| commission_rate | DECIMAL(5,2) | DEFAULT 0 | Commission percentage |
| hourly_rate | DECIMAL(10,2) | NULL | Hourly pay rate |
| employment_type | ENUM | DEFAULT 'full_time' | 'full_time', 'part_time', 'contractor' |
| hire_date | DATE | NULL | Employment start date |
| can_accept_bookings | BOOLEAN | DEFAULT true | Booking availability |
| booking_buffer_minutes | INT | DEFAULT 0 | Buffer between appointments |
| max_daily_appointments | INT | NULL | Daily appointment limit |
| color | VARCHAR(7) | NULL | Calendar color (hex) |
| sort_order | INT | DEFAULT 0 | Display order |
| is_active | BOOLEAN | DEFAULT true | Active status |
| settings | JSONB | DEFAULT '{}' | Staff-specific settings |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete |

#### `staff_locations`
Many-to-many: Staff can work at multiple locations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| staff_id | UUID | FK → staff.id | Staff reference |
| location_id | UUID | FK → locations.id | Location reference |
| is_primary | BOOLEAN | DEFAULT false | Primary location |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Unique Constraint:** (staff_id, location_id)

#### `staff_schedules`
Work schedules for staff members.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| staff_id | UUID | FK → staff.id | Staff reference |
| location_id | UUID | FK → locations.id | Location for this schedule |
| day_of_week | INT | NOT NULL (0-6) | Day of week |
| start_time | TIME | NOT NULL | Shift start |
| end_time | TIME | NOT NULL | Shift end |
| is_working | BOOLEAN | DEFAULT true | Working this day |
| effective_from | DATE | NULL | Schedule start date |
| effective_until | DATE | NULL | Schedule end date |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

#### `staff_breaks`
Break times within staff schedules.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| staff_schedule_id | UUID | FK → staff_schedules.id | Schedule reference |
| start_time | TIME | NOT NULL | Break start |
| end_time | TIME | NOT NULL | Break end |
| is_paid | BOOLEAN | DEFAULT false | Paid break |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

#### `staff_time_off`
Time off requests and approvals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| staff_id | UUID | FK → staff.id | Staff reference |
| start_date | DATE | NOT NULL | Start date |
| end_date | DATE | NOT NULL | End date |
| start_time | TIME | NULL | Partial day start |
| end_time | TIME | NULL | Partial day end |
| type | ENUM | NOT NULL | 'vacation', 'sick', 'personal', 'other' |
| status | ENUM | DEFAULT 'pending' | 'pending', 'approved', 'rejected' |
| notes | TEXT | NULL | Request notes |
| approved_by | UUID | FK → users.id, NULL | Approver |
| approved_at | TIMESTAMPTZ | NULL | Approval timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### 4. Services & Categories

#### `service_categories`
Categories to organize services.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| name | VARCHAR(100) | NOT NULL | Category name |
| description | TEXT | NULL | Category description |
| color | VARCHAR(7) | NULL | Display color (hex) |
| icon | VARCHAR(50) | NULL | Icon identifier |
| sort_order | INT | DEFAULT 0 | Display order |
| is_active | BOOLEAN | DEFAULT true | Active status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete |

#### `services`
Services offered by the business.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| category_id | UUID | FK → service_categories.id, NULL | Category reference |
| name | VARCHAR(255) | NOT NULL | Service name |
| description | TEXT | NULL | Service description |
| duration_minutes | INT | NOT NULL | Service duration |
| buffer_before_minutes | INT | DEFAULT 0 | Buffer before |
| buffer_after_minutes | INT | DEFAULT 0 | Buffer after |
| price | DECIMAL(10,2) | NOT NULL | Base price |
| price_type | ENUM | DEFAULT 'fixed' | 'fixed', 'starting_at', 'variable' |
| max_price | DECIMAL(10,2) | NULL | Max price (for variable) |
| deposit_amount | DECIMAL(10,2) | NULL | Required deposit |
| deposit_type | ENUM | DEFAULT 'fixed' | 'fixed', 'percentage' |
| tax_rate | DECIMAL(5,2) | NULL | Tax percentage |
| is_taxable | BOOLEAN | DEFAULT true | Subject to tax |
| color | VARCHAR(7) | NULL | Calendar color |
| image_url | TEXT | NULL | Service image |
| is_online_booking | BOOLEAN | DEFAULT true | Show in online booking |
| is_active | BOOLEAN | DEFAULT true | Active status |
| sort_order | INT | DEFAULT 0 | Display order |
| settings | JSONB | DEFAULT '{}' | Additional settings |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete |

#### `service_variations`
Price/duration variations for services.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| service_id | UUID | FK → services.id | Service reference |
| name | VARCHAR(100) | NOT NULL | Variation name |
| duration_minutes | INT | NOT NULL | Duration |
| price | DECIMAL(10,2) | NOT NULL | Price |
| sort_order | INT | DEFAULT 0 | Display order |
| is_active | BOOLEAN | DEFAULT true | Active status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

#### `staff_services`
Services that staff members can perform.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| staff_id | UUID | FK → staff.id | Staff reference |
| service_id | UUID | FK → services.id | Service reference |
| custom_duration | INT | NULL | Override duration |
| custom_price | DECIMAL(10,2) | NULL | Override price |
| commission_rate | DECIMAL(5,2) | NULL | Service-specific commission |
| is_active | BOOLEAN | DEFAULT true | Can perform this service |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Unique Constraint:** (staff_id, service_id)

### 5. Clients

#### `clients`
Client profiles for the business.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| user_id | UUID | FK → users.id, NULL | Linked user account |
| email | VARCHAR(255) | NULL | Client email |
| phone | VARCHAR(20) | NULL | Client phone |
| first_name | VARCHAR(100) | NOT NULL | First name |
| last_name | VARCHAR(100) | NOT NULL | Last name |
| date_of_birth | DATE | NULL | Birthday |
| gender | VARCHAR(20) | NULL | Gender |
| address_line_1 | VARCHAR(255) | NULL | Address |
| address_line_2 | VARCHAR(255) | NULL | Address line 2 |
| city | VARCHAR(100) | NULL | City |
| state | VARCHAR(100) | NULL | State |
| postal_code | VARCHAR(20) | NULL | Postal code |
| country | VARCHAR(2) | NULL | Country code |
| preferred_location_id | UUID | FK → locations.id, NULL | Preferred location |
| preferred_staff_id | UUID | FK → staff.id, NULL | Preferred staff |
| notes | TEXT | NULL | Internal notes |
| tags | TEXT[] | DEFAULT '{}' | Client tags |
| source | VARCHAR(50) | NULL | How they found business |
| referral_source | VARCHAR(255) | NULL | Referral details |
| marketing_consent | BOOLEAN | DEFAULT false | Marketing opt-in |
| sms_consent | BOOLEAN | DEFAULT false | SMS opt-in |
| email_consent | BOOLEAN | DEFAULT true | Email opt-in |
| total_spent | DECIMAL(12,2) | DEFAULT 0 | Lifetime spend |
| total_visits | INT | DEFAULT 0 | Total appointments |
| last_visit_at | TIMESTAMPTZ | NULL | Last appointment |
| loyalty_points | INT | DEFAULT 0 | Loyalty points |
| is_blocked | BOOLEAN | DEFAULT false | Blocked status |
| blocked_reason | TEXT | NULL | Block reason |
| metadata | JSONB | DEFAULT '{}' | Additional data |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete |

**Unique Constraint:** (business_id, email) WHERE email IS NOT NULL
**Unique Constraint:** (business_id, phone) WHERE phone IS NOT NULL

### 6. Appointments & Bookings

#### `appointments`
Main appointments table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| location_id | UUID | FK → locations.id | Location reference |
| client_id | UUID | FK → clients.id, NULL | Client reference |
| booking_reference | VARCHAR(20) | UNIQUE, NOT NULL | Human-readable reference |
| status | ENUM | DEFAULT 'pending' | See status enum below |
| source | ENUM | DEFAULT 'online' | 'online', 'walk_in', 'phone', 'app', 'pos' |
| start_time | TIMESTAMPTZ | NOT NULL | Appointment start |
| end_time | TIMESTAMPTZ | NOT NULL | Appointment end |
| total_duration | INT | NOT NULL | Total duration minutes |
| subtotal | DECIMAL(10,2) | NOT NULL | Subtotal before tax |
| tax_amount | DECIMAL(10,2) | DEFAULT 0 | Tax amount |
| discount_amount | DECIMAL(10,2) | DEFAULT 0 | Discount amount |
| total_amount | DECIMAL(10,2) | NOT NULL | Final total |
| deposit_amount | DECIMAL(10,2) | DEFAULT 0 | Deposit collected |
| notes | TEXT | NULL | Appointment notes |
| internal_notes | TEXT | NULL | Staff-only notes |
| cancellation_reason | TEXT | NULL | If cancelled |
| cancelled_by | UUID | FK → users.id, NULL | Who cancelled |
| cancelled_at | TIMESTAMPTZ | NULL | Cancellation time |
| no_show_at | TIMESTAMPTZ | NULL | Marked no-show time |
| checked_in_at | TIMESTAMPTZ | NULL | Check-in time |
| completed_at | TIMESTAMPTZ | NULL | Completion time |
| rescheduled_from | UUID | FK → appointments.id, NULL | Original appointment |
| rescheduled_to | UUID | FK → appointments.id, NULL | New appointment |
| reminder_sent_at | TIMESTAMPTZ | NULL | Reminder sent |
| confirmation_sent_at | TIMESTAMPTZ | NULL | Confirmation sent |
| created_by | UUID | FK → users.id, NULL | Who created |
| metadata | JSONB | DEFAULT '{}' | Additional data |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Appointment Status Enum:**
- `pending` - Awaiting confirmation
- `confirmed` - Confirmed by business/staff
- `checked_in` - Client has arrived
- `in_progress` - Service is being performed
- `completed` - Service completed
- `cancelled` - Cancelled
- `no_show` - Client did not show up

#### `appointment_services`
Services included in an appointment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| appointment_id | UUID | FK → appointments.id | Appointment reference |
| service_id | UUID | FK → services.id | Service reference |
| service_variation_id | UUID | FK → service_variations.id, NULL | Variation reference |
| staff_id | UUID | FK → staff.id | Staff performing |
| name | VARCHAR(255) | NOT NULL | Service name (snapshot) |
| duration_minutes | INT | NOT NULL | Duration (snapshot) |
| price | DECIMAL(10,2) | NOT NULL | Price (snapshot) |
| discount_amount | DECIMAL(10,2) | DEFAULT 0 | Discount applied |
| tax_amount | DECIMAL(10,2) | DEFAULT 0 | Tax amount |
| final_price | DECIMAL(10,2) | NOT NULL | Final price |
| start_time | TIMESTAMPTZ | NOT NULL | Service start |
| end_time | TIMESTAMPTZ | NOT NULL | Service end |
| status | ENUM | DEFAULT 'scheduled' | 'scheduled', 'in_progress', 'completed' |
| notes | TEXT | NULL | Service notes |
| sort_order | INT | DEFAULT 0 | Order in appointment |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

#### `appointment_products`
Products sold during appointment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| appointment_id | UUID | FK → appointments.id | Appointment reference |
| product_id | UUID | FK → products.id | Product reference |
| staff_id | UUID | FK → staff.id, NULL | Staff who sold |
| name | VARCHAR(255) | NOT NULL | Product name (snapshot) |
| quantity | INT | NOT NULL DEFAULT 1 | Quantity |
| unit_price | DECIMAL(10,2) | NOT NULL | Unit price |
| discount_amount | DECIMAL(10,2) | DEFAULT 0 | Discount |
| tax_amount | DECIMAL(10,2) | DEFAULT 0 | Tax |
| total_price | DECIMAL(10,2) | NOT NULL | Total price |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

### 7. Payments & Transactions

#### `payments`
Payment records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| appointment_id | UUID | FK → appointments.id, NULL | Appointment reference |
| client_id | UUID | FK → clients.id, NULL | Client reference |
| payment_reference | VARCHAR(50) | UNIQUE, NOT NULL | Payment reference |
| type | ENUM | NOT NULL | 'payment', 'refund', 'deposit', 'tip' |
| method | ENUM | NOT NULL | 'cash', 'card', 'online', 'gift_card', 'other' |
| status | ENUM | DEFAULT 'pending' | 'pending', 'completed', 'failed', 'refunded' |
| amount | DECIMAL(10,2) | NOT NULL | Payment amount |
| tip_amount | DECIMAL(10,2) | DEFAULT 0 | Tip amount |
| total_amount | DECIMAL(10,2) | NOT NULL | Total with tip |
| currency | VARCHAR(3) | NOT NULL | Currency code |
| processor | VARCHAR(50) | NULL | Payment processor |
| processor_id | VARCHAR(255) | NULL | Processor transaction ID |
| processor_response | JSONB | NULL | Processor response data |
| card_last_four | VARCHAR(4) | NULL | Last 4 card digits |
| card_brand | VARCHAR(20) | NULL | Card brand |
| receipt_url | TEXT | NULL | Receipt URL |
| notes | TEXT | NULL | Payment notes |
| processed_by | UUID | FK → users.id, NULL | Staff who processed |
| processed_at | TIMESTAMPTZ | NULL | Processing time |
| refunded_amount | DECIMAL(10,2) | DEFAULT 0 | Amount refunded |
| refunded_at | TIMESTAMPTZ | NULL | Refund time |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

#### `invoices`
Invoices for appointments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| appointment_id | UUID | FK → appointments.id, NULL | Appointment reference |
| client_id | UUID | FK → clients.id, NULL | Client reference |
| invoice_number | VARCHAR(50) | UNIQUE, NOT NULL | Invoice number |
| status | ENUM | DEFAULT 'draft' | 'draft', 'sent', 'paid', 'overdue', 'cancelled' |
| subtotal | DECIMAL(10,2) | NOT NULL | Subtotal |
| tax_amount | DECIMAL(10,2) | DEFAULT 0 | Tax |
| discount_amount | DECIMAL(10,2) | DEFAULT 0 | Discount |
| total_amount | DECIMAL(10,2) | NOT NULL | Total |
| amount_paid | DECIMAL(10,2) | DEFAULT 0 | Amount paid |
| amount_due | DECIMAL(10,2) | NOT NULL | Amount due |
| currency | VARCHAR(3) | NOT NULL | Currency |
| due_date | DATE | NULL | Due date |
| notes | TEXT | NULL | Invoice notes |
| sent_at | TIMESTAMPTZ | NULL | When sent |
| paid_at | TIMESTAMPTZ | NULL | When paid |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

#### `gift_cards`
Gift cards issued by the business.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| code | VARCHAR(50) | UNIQUE, NOT NULL | Gift card code |
| initial_value | DECIMAL(10,2) | NOT NULL | Original value |
| current_balance | DECIMAL(10,2) | NOT NULL | Current balance |
| currency | VARCHAR(3) | NOT NULL | Currency |
| purchased_by | UUID | FK → clients.id, NULL | Purchaser |
| recipient_email | VARCHAR(255) | NULL | Recipient email |
| recipient_name | VARCHAR(255) | NULL | Recipient name |
| personal_message | TEXT | NULL | Gift message |
| expires_at | TIMESTAMPTZ | NULL | Expiration date |
| is_active | BOOLEAN | DEFAULT true | Active status |
| redeemed_at | TIMESTAMPTZ | NULL | First redemption |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### 8. Products & Inventory

#### `product_categories`
Categories for products.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| name | VARCHAR(100) | NOT NULL | Category name |
| description | TEXT | NULL | Description |
| sort_order | INT | DEFAULT 0 | Display order |
| is_active | BOOLEAN | DEFAULT true | Active status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

#### `products`
Retail products sold by the business.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| category_id | UUID | FK → product_categories.id, NULL | Category |
| sku | VARCHAR(100) | NULL | Stock keeping unit |
| barcode | VARCHAR(100) | NULL | Barcode/UPC |
| name | VARCHAR(255) | NOT NULL | Product name |
| description | TEXT | NULL | Description |
| brand | VARCHAR(100) | NULL | Brand name |
| cost_price | DECIMAL(10,2) | NULL | Cost/wholesale price |
| retail_price | DECIMAL(10,2) | NOT NULL | Retail price |
| tax_rate | DECIMAL(5,2) | NULL | Tax rate |
| is_taxable | BOOLEAN | DEFAULT true | Subject to tax |
| image_url | TEXT | NULL | Product image |
| is_active | BOOLEAN | DEFAULT true | Active status |
| is_sellable_online | BOOLEAN | DEFAULT false | Online sales |
| commission_rate | DECIMAL(5,2) | NULL | Commission on sales |
| metadata | JSONB | DEFAULT '{}' | Additional data |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete |

**Unique Constraint:** (business_id, sku) WHERE sku IS NOT NULL

#### `product_inventory`
Inventory levels per location.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| product_id | UUID | FK → products.id | Product reference |
| location_id | UUID | FK → locations.id | Location reference |
| quantity | INT | NOT NULL DEFAULT 0 | Current quantity |
| low_stock_threshold | INT | NULL | Low stock alert level |
| reorder_point | INT | NULL | Reorder level |
| reorder_quantity | INT | NULL | Default reorder qty |
| last_restock_at | TIMESTAMPTZ | NULL | Last restock |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Unique Constraint:** (product_id, location_id)

#### `inventory_transactions`
Inventory movement history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| product_id | UUID | FK → products.id | Product reference |
| location_id | UUID | FK → locations.id | Location reference |
| type | ENUM | NOT NULL | 'sale', 'return', 'adjustment', 'transfer', 'restock' |
| quantity_change | INT | NOT NULL | Quantity change (+ or -) |
| quantity_after | INT | NOT NULL | Quantity after transaction |
| reference_type | VARCHAR(50) | NULL | Reference table |
| reference_id | UUID | NULL | Reference record ID |
| notes | TEXT | NULL | Transaction notes |
| performed_by | UUID | FK → users.id, NULL | Who performed |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

### 9. Staff Commissions

#### `commissions`
Commission records for staff.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| staff_id | UUID | FK → staff.id | Staff reference |
| appointment_id | UUID | FK → appointments.id, NULL | Appointment reference |
| type | ENUM | NOT NULL | 'service', 'product', 'tip' |
| reference_type | VARCHAR(50) | NOT NULL | 'appointment_service', 'appointment_product' |
| reference_id | UUID | NOT NULL | Reference record ID |
| gross_amount | DECIMAL(10,2) | NOT NULL | Gross sale amount |
| commission_rate | DECIMAL(5,2) | NOT NULL | Commission rate used |
| commission_amount | DECIMAL(10,2) | NOT NULL | Commission earned |
| status | ENUM | DEFAULT 'pending' | 'pending', 'approved', 'paid' |
| period_start | DATE | NOT NULL | Pay period start |
| period_end | DATE | NOT NULL | Pay period end |
| paid_at | TIMESTAMPTZ | NULL | When paid |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

#### `payroll_periods`
Payroll periods for tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| period_start | DATE | NOT NULL | Period start |
| period_end | DATE | NOT NULL | Period end |
| status | ENUM | DEFAULT 'open' | 'open', 'closed', 'paid' |
| closed_at | TIMESTAMPTZ | NULL | When closed |
| paid_at | TIMESTAMPTZ | NULL | When paid |
| notes | TEXT | NULL | Period notes |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### 10. Notifications

#### `notification_templates`
Notification templates for the business.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id, NULL | Business (null = system) |
| type | ENUM | NOT NULL | 'appointment_confirmation', 'reminder', etc. |
| channel | ENUM | NOT NULL | 'email', 'sms', 'push' |
| name | VARCHAR(100) | NOT NULL | Template name |
| subject | VARCHAR(255) | NULL | Email subject |
| body | TEXT | NOT NULL | Template body |
| variables | TEXT[] | DEFAULT '{}' | Available variables |
| is_active | BOOLEAN | DEFAULT true | Active status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

#### `notifications`
Sent notifications log.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| user_id | UUID | FK → users.id, NULL | Recipient user |
| client_id | UUID | FK → clients.id, NULL | Recipient client |
| template_id | UUID | FK → notification_templates.id, NULL | Template used |
| type | VARCHAR(50) | NOT NULL | Notification type |
| channel | ENUM | NOT NULL | 'email', 'sms', 'push' |
| recipient | VARCHAR(255) | NOT NULL | Email/phone |
| subject | VARCHAR(255) | NULL | Subject line |
| body | TEXT | NOT NULL | Notification body |
| status | ENUM | DEFAULT 'pending' | 'pending', 'sent', 'delivered', 'failed' |
| sent_at | TIMESTAMPTZ | NULL | When sent |
| delivered_at | TIMESTAMPTZ | NULL | When delivered |
| opened_at | TIMESTAMPTZ | NULL | When opened |
| clicked_at | TIMESTAMPTZ | NULL | When clicked |
| failed_reason | TEXT | NULL | Failure reason |
| metadata | JSONB | DEFAULT '{}' | Additional data |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

### 11. Reviews & Ratings

#### `reviews`
Client reviews for appointments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| location_id | UUID | FK → locations.id | Location reference |
| appointment_id | UUID | FK → appointments.id, NULL | Appointment reference |
| client_id | UUID | FK → clients.id | Client who reviewed |
| staff_id | UUID | FK → staff.id, NULL | Staff reviewed |
| overall_rating | INT | NOT NULL CHECK (1-5) | Overall rating |
| service_rating | INT | NULL CHECK (1-5) | Service rating |
| staff_rating | INT | NULL CHECK (1-5) | Staff rating |
| cleanliness_rating | INT | NULL CHECK (1-5) | Cleanliness rating |
| value_rating | INT | NULL CHECK (1-5) | Value rating |
| comment | TEXT | NULL | Review comment |
| response | TEXT | NULL | Business response |
| responded_at | TIMESTAMPTZ | NULL | Response time |
| responded_by | UUID | FK → users.id, NULL | Who responded |
| is_public | BOOLEAN | DEFAULT true | Publicly visible |
| is_verified | BOOLEAN | DEFAULT false | Verified purchase |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### 12. Discounts & Promotions

#### `discounts`
Discount codes and promotions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id | Business reference |
| code | VARCHAR(50) | NULL | Discount code |
| name | VARCHAR(100) | NOT NULL | Discount name |
| description | TEXT | NULL | Description |
| type | ENUM | NOT NULL | 'percentage', 'fixed', 'free_service' |
| value | DECIMAL(10,2) | NOT NULL | Discount value |
| min_purchase | DECIMAL(10,2) | NULL | Minimum purchase |
| max_discount | DECIMAL(10,2) | NULL | Maximum discount |
| applies_to | ENUM | DEFAULT 'all' | 'all', 'services', 'products', 'specific' |
| service_ids | UUID[] | DEFAULT '{}' | Specific services |
| product_ids | UUID[] | DEFAULT '{}' | Specific products |
| usage_limit | INT | NULL | Total usage limit |
| usage_count | INT | DEFAULT 0 | Times used |
| per_client_limit | INT | NULL | Per-client limit |
| first_visit_only | BOOLEAN | DEFAULT false | New clients only |
| valid_from | TIMESTAMPTZ | NULL | Start date |
| valid_until | TIMESTAMPTZ | NULL | End date |
| is_active | BOOLEAN | DEFAULT true | Active status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Unique Constraint:** (business_id, code) WHERE code IS NOT NULL

### 13. Audit & Activity Logs

#### `audit_logs`
System audit trail.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| business_id | UUID | FK → businesses.id, NULL | Business reference |
| user_id | UUID | FK → users.id, NULL | User who performed |
| action | VARCHAR(50) | NOT NULL | Action type |
| entity_type | VARCHAR(50) | NOT NULL | Table/entity name |
| entity_id | UUID | NULL | Record ID |
| old_values | JSONB | NULL | Previous values |
| new_values | JSONB | NULL | New values |
| ip_address | INET | NULL | IP address |
| user_agent | TEXT | NULL | Browser/client info |
| metadata | JSONB | DEFAULT '{}' | Additional context |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Timestamp |

## Indexes

### Performance Indexes

```sql
-- Users
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Businesses
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_slug ON businesses(slug);

-- Locations
CREATE INDEX idx_locations_business_id ON locations(business_id);
CREATE INDEX idx_locations_coords ON locations(latitude, longitude);

-- Staff
CREATE INDEX idx_staff_user_id ON staff(user_id);
CREATE INDEX idx_staff_location_id ON staff(location_id);

-- Services
CREATE INDEX idx_services_business_id ON services(business_id);
CREATE INDEX idx_services_category_id ON services(category_id);

-- Clients
CREATE INDEX idx_clients_business_id ON clients(business_id);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_email ON clients(business_id, email);
CREATE INDEX idx_clients_phone ON clients(business_id, phone);

-- Appointments
CREATE INDEX idx_appointments_business_id ON appointments(business_id);
CREATE INDEX idx_appointments_location_id ON appointments(location_id);
CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_appointments_booking_ref ON appointments(booking_reference);

-- Appointment Services
CREATE INDEX idx_appointment_services_appointment ON appointment_services(appointment_id);
CREATE INDEX idx_appointment_services_staff ON appointment_services(staff_id);

-- Payments
CREATE INDEX idx_payments_business_id ON payments(business_id);
CREATE INDEX idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX idx_payments_client_id ON payments(client_id);

-- Products
CREATE INDEX idx_products_business_id ON products(business_id);
CREATE INDEX idx_products_sku ON products(business_id, sku);

-- Notifications
CREATE INDEX idx_notifications_business_id ON notifications(business_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- Audit Logs
CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

## Row Level Security (RLS)

Supabase RLS policies to secure data:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
-- ... (enable for all tables)

-- Example policies
-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = auth_id);

-- Business owners can manage their business
CREATE POLICY "Owners can manage business" ON businesses
  FOR ALL USING (owner_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

-- Staff can view their business data
CREATE POLICY "Staff can view business data" ON locations
  FOR SELECT USING (business_id IN (
    SELECT s.business_id FROM staff s
    JOIN users u ON s.user_id = u.id
    WHERE u.auth_id = auth.uid()
  ));
```

## Data Retention

- Soft delete pattern used for most entities
- Audit logs retained for 2 years
- Cancelled appointments retained for 90 days
- Notifications archived after 30 days
