# SAL Platform -- Production-Ready Feature Checklist

Exhaustive audit of every feature required to compete with Fresha, Vagaro, Mindbody, Boulevard, Square Appointments, Acuity, Booksy, GlossGenius, Zenoti, Phorest, Mangomint, Meevo, and DaySmart.

---

## 1. Core Booking Engine

### 1.1 Appointment Types
- [ ] One-on-one appointments (single client + single provider)
- [ ] Multi-service appointments (client books multiple services in one session)
- [ ] Service combos / packages (pre-defined bundles, e.g. "Cut + Color + Blowout")
- [ ] Add-on services (optional upgrades selectable during booking, e.g. deep conditioning)
- [ ] Class / group bookings (multiple clients in one time slot, e.g. yoga, makeup class)
- [ ] Workshop / event bookings (one-off special events with capacity limits)
- [ ] Recurring / standing appointments (weekly, biweekly, monthly auto-repeat)
- [ ] Walk-in appointments (quick-add from calendar without client pre-booking)
- [ ] Block / personal time (lunch, admin time, training -- non-bookable)
- [ ] Consultation appointments (free or paid discovery sessions)
- [ ] Virtual / video appointments (telehealth / virtual consultations)

### 1.2 Scheduling Logic
- [ ] Service duration auto-calculation from service catalog
- [ ] Buffer time between appointments (cleanup / transition time)
- [ ] Processing time support (e.g. 30 min color processing where stylist is free)
- [ ] Finishing time (post-service time, e.g. blowout after color)
- [ ] Multi-segment appointments (apply color -> process -> rinse -> style, each segment timed)
- [ ] Double-booking / overlap prevention
- [ ] Overbooking allowance (configurable per provider)
- [ ] Smart gap-filling (suggest times that minimize gaps in the schedule)
- [ ] Minimum lead time (e.g. must book at least 2 hours in advance)
- [ ] Maximum advance booking window (e.g. can only book up to 90 days ahead)
- [ ] Same-day booking toggle (allow/disallow)
- [ ] Cancellation window enforcement (e.g. no cancel within 24 hours)
- [ ] Rescheduling window enforcement
- [ ] No-show tracking per client (auto-flag repeat offenders)
- [ ] Late arrival grace period configuration

### 1.3 Resource Management
- [ ] Room / treatment room assignment per service
- [ ] Equipment assignment (e.g. laser machine, color station, wash basin)
- [ ] Room capacity tracking (max simultaneous bookings per room)
- [ ] Equipment availability checks (prevent double-booking equipment)
- [ ] Resource-service linking (certain services require certain rooms/equipment)
- [ ] Resource calendar view (see room/equipment utilization)
- [ ] Automatic resource allocation (system picks best available room)

### 1.4 Multi-Provider / Multi-Service
- [ ] Assign multiple providers to one appointment (e.g. colorist + stylist)
- [ ] Provider handoff during multi-segment appointments
- [ ] "Any available" provider option (system auto-assigns)
- [ ] Provider skill / certification matching (only show qualified providers for service)
- [ ] Service-provider mapping (which providers can perform which services)
- [ ] Provider-specific pricing (senior stylist charges more than junior)
- [ ] Provider-specific duration overrides

### 1.5 Timezone Handling
- [ ] Business timezone setting (per location)
- [ ] Client timezone detection (for online booking)
- [ ] Timezone conversion display (show appointment in client's local time)
- [ ] DST (Daylight Saving Time) automatic adjustment
- [ ] Multi-timezone support for multi-location businesses

---

## 2. Online Booking

### 2.1 Booking Interface
- [ ] Branded booking page (custom URL, logo, colors, fonts)
- [ ] Embeddable booking widget (iframe / JS snippet for any website)
- [ ] Mobile-responsive booking flow
- [ ] Service category browsing with descriptions and photos
- [ ] Service duration and price display
- [ ] "Starting from" pricing for variable-price services
- [ ] Staff profile cards with photos, bio, specialties
- [ ] Staff preference selection (choose provider or "no preference")
- [ ] Location selector (for multi-location businesses)
- [ ] Language / locale selection
- [ ] Accessibility (WCAG 2.1 AA compliance)

### 2.2 Availability & Selection
- [ ] Real-time availability calendar
- [ ] Next available slot suggestion
- [ ] Date picker with available dates highlighted
- [ ] Time slot grid with available times
- [ ] Multiple service selection in single booking flow
- [ ] Service ordering / sequencing logic
- [ ] Estimated total duration display
- [ ] Estimated total price display (including add-ons)
- [ ] "Book again" (re-book same service with same provider)
- [ ] Express re-booking link (one-click rebook from confirmation email)

### 2.3 Client Input During Booking
- [ ] New client registration during booking
- [ ] Returning client login / lookup
- [ ] Guest booking (no account required)
- [ ] Custom intake form fields (allergies, preferences, medical history)
- [ ] File / photo upload during booking
- [ ] Special request / notes field
- [ ] Cancellation policy acknowledgment (checkbox or signature)
- [ ] Terms & conditions acceptance
- [ ] Marketing opt-in checkbox (SMS, email)
- [ ] Referral source tracking ("How did you hear about us?")

### 2.4 Payments During Booking
- [ ] Full prepayment at booking
- [ ] Percentage-based deposit (e.g. 50% upfront)
- [ ] Flat-rate deposit (e.g. $25 booking fee)
- [ ] Card-on-file requirement (hold card, charge later)
- [ ] No payment required (pay at visit)
- [ ] Service-specific deposit rules (high-value services require deposit)
- [ ] Client-specific deposit rules (repeat no-show clients must prepay)
- [ ] Payment via credit/debit card
- [ ] Payment via Apple Pay / Google Pay
- [ ] Payment via Klarna / Afterpay (buy now, pay later)
- [ ] Gift card / voucher redemption during booking
- [ ] Package / membership credit redemption during booking
- [ ] Promo code / coupon code field

### 2.5 Waitlist
- [ ] Join waitlist for fully-booked times
- [ ] Waitlist priority rules (first-come, highest-value client, manual)
- [ ] Automatic waitlist notification when slot opens
- [ ] One-click booking from waitlist notification
- [ ] Waitlist expiration (auto-remove after X days)
- [ ] Waitlist analytics (how many joined, converted, expired)

### 2.6 Confirmation & Reminder Flow
- [ ] Instant booking confirmation (email)
- [ ] Instant booking confirmation (SMS)
- [ ] Booking confirmation (push notification)
- [ ] Booking confirmation (WhatsApp)
- [ ] Calendar invite attachment (.ics file)
- [ ] 48-hour reminder
- [ ] 24-hour reminder
- [ ] 2-hour reminder
- [ ] Customizable reminder timing (per service or global)
- [ ] Confirm / Cancel buttons in reminder messages
- [ ] Two-way SMS confirmation ("Reply Y to confirm")
- [ ] Directions / map link in confirmation
- [ ] Parking / arrival instructions in confirmation
- [ ] Pre-visit checklist (what to bring, preparation instructions)
- [ ] Intake form link in confirmation (fill out before arrival)

### 2.7 Cancellation & Rescheduling
- [ ] Client self-service cancellation (within policy window)
- [ ] Client self-service rescheduling
- [ ] Cancellation reason collection
- [ ] Cancellation fee enforcement (charge card on file)
- [ ] Late cancellation fee (different from no-show fee)
- [ ] No-show fee enforcement
- [ ] Cancellation waiting period before slot reopens
- [ ] Rebook prompt after cancellation

### 2.8 Booking Channels
- [ ] Direct website booking
- [ ] Instagram "Book Now" button integration
- [ ] Facebook "Book Now" button integration
- [ ] Google Reserve / Google Business Profile booking
- [ ] Marketplace listing (Fresha marketplace, Vagaro marketplace, etc.)
- [ ] QR code for booking page
- [ ] Booking link sharing (SMS, email, social)
- [ ] In-app booking (if native app exists)

---

## 3. Calendar

### 3.1 Views
- [ ] Day view
- [ ] Week view (7-day)
- [ ] Multi-day view (configurable: 2-day, 3-day, 4-day, 5-day)
- [ ] Month view (overview with appointment counts)
- [ ] Agenda / list view
- [ ] Column-per-staff view (each staff member is a column)
- [ ] Column-per-room/resource view
- [ ] Split view (multiple staff side by side)
- [ ] Timeline view (horizontal scrolling)

### 3.2 Interactions
- [ ] Click-to-create appointment
- [ ] Drag-to-create appointment (click and drag on empty slot)
- [ ] Drag-to-move / reschedule (move appointment to new time)
- [ ] Drag-to-reassign (move appointment to different staff column)
- [ ] Drag-to-resize (change appointment duration by dragging edge)
- [ ] Right-click context menu on appointments
- [ ] Double-click to open appointment details
- [ ] Quick-action buttons on appointment blocks (checkout, cancel, no-show)

### 3.3 Visual Customization
- [ ] Color coding by service category
- [ ] Color coding by appointment status (booked, confirmed, arrived, in-progress, completed, no-show, cancelled)
- [ ] Color coding by staff member (team colors)
- [ ] Custom color per service
- [ ] Appointment block shows: client name, service, duration, status icon
- [ ] Appointment block tooltip on hover (full details)
- [ ] Working hours shading (gray out non-working hours)
- [ ] Break time display
- [ ] Day-off indicators
- [ ] Holiday markers
- [ ] Current time indicator line (red line showing "now")
- [ ] Past appointments dimmed / grayed
- [ ] Overflow indicator ("+3 more" when too many appointments)

### 3.4 Filtering & Search
- [ ] Filter by staff member
- [ ] Filter by service
- [ ] Filter by service category
- [ ] Filter by appointment status
- [ ] Filter by location
- [ ] Filter by room / resource
- [ ] Saved filter presets (save and recall custom filter combos)
- [ ] Search appointments by client name
- [ ] Search appointments by phone number
- [ ] Jump to specific date (date picker)
- [ ] Today button (return to current day)

### 3.5 Calendar Controls
- [ ] Zoom slider (adjust time slot height: 5min, 10min, 15min, 30min, 60min intervals)
- [ ] Scroll to current time on load
- [ ] Keyboard navigation (arrow keys, shortcuts)
- [ ] Pinch-to-zoom on mobile
- [ ] Swipe between days on mobile
- [ ] Print schedule (daily, weekly)
- [ ] Export schedule (PDF, CSV)
- [ ] Auto-refresh / real-time updates (live sync across devices)
- [ ] Undo last action (undo move, undo cancel)
- [ ] Calendar preferences saved per user (localStorage or server)

### 3.6 Calendar Overlays & Indicators
- [ ] Staff availability overlay (show who's available when)
- [ ] Resource availability overlay
- [ ] Waitlist indicator on time slots
- [ ] Online booking indicator (appointments booked online vs. in-store)
- [ ] Appointment source indicator (walk-in, phone, online, app)
- [ ] Status legend
- [ ] Live clock in header

---

## 4. Client Management (CRM)

### 4.1 Client Profile
- [ ] Basic info: name, email, phone, address, date of birth, gender, pronouns
- [ ] Profile photo (upload or capture)
- [ ] Preferred name / nickname
- [ ] Preferred communication channel (SMS, email, WhatsApp)
- [ ] Preferred language
- [ ] Emergency contact
- [ ] Referral source
- [ ] Client since date
- [ ] Client tags / labels (VIP, new, loyal, at-risk, etc.)
- [ ] Custom fields (unlimited user-defined fields)
- [ ] Client notes (free-text, pinned notes, timestamped)
- [ ] Internal staff alerts on client profile ("allergy to X", "always late", "cash only")
- [ ] "New client" badge (auto-applied, auto-removed after first visit)

### 4.2 Service History & Formulas
- [ ] Full appointment history (past and upcoming)
- [ ] Service details per visit (what was done, by whom, when)
- [ ] Color formula records (hair color history with exact formulas)
- [ ] Treatment notes per visit
- [ ] Product recommendations per visit
- [ ] Before/after photos per visit
- [ ] Photo gallery per client (organized by date)
- [ ] Photo markup / annotation (draw on photos)
- [ ] Photo comparison slider (before vs. after side by side)

### 4.3 Forms & Documentation
- [ ] Digital intake forms (pre-visit questionnaires)
- [ ] Consent forms (digital signature capture)
- [ ] Medical history forms
- [ ] Allergy / sensitivity forms
- [ ] SOAP notes (Subjective, Objective, Assessment, Plan -- for medspas)
- [ ] Treatment plan documentation
- [ ] Form templates (reusable, customizable)
- [ ] Auto-send forms before appointment (via email/SMS)
- [ ] Form completion tracking (mark incomplete forms)
- [ ] PDF export of completed forms
- [ ] Form versioning (track changes to form templates)
- [ ] E-signature with timestamp and IP logging
- [ ] HIPAA-compliant form storage (for medical spas)

### 4.4 Financial History
- [ ] Purchase history (all transactions)
- [ ] Product purchase history
- [ ] Service purchase history
- [ ] Lifetime value calculation (total spent)
- [ ] Average ticket value
- [ ] Tip history
- [ ] Outstanding balance / credit balance
- [ ] Client wallet / prepaid balance
- [ ] Gift cards owned
- [ ] Active memberships
- [ ] Active packages (remaining sessions)
- [ ] Payment methods on file (saved cards)
- [ ] Invoice history

### 4.5 Communication History
- [ ] SMS conversation history (two-way)
- [ ] Email history
- [ ] WhatsApp conversation history
- [ ] Phone call log (with call recordings and transcripts if available)
- [ ] Web chat history
- [ ] Marketing messages sent / opened / clicked
- [ ] Review requests sent and responses
- [ ] Communication timeline (unified view of all touchpoints)

### 4.6 Segmentation & Targeting
- [ ] Auto-segments (new clients, lapsed clients, VIPs, birthday this month)
- [ ] Custom segments (filter by any combination of fields)
- [ ] Segment by service history (clients who booked service X)
- [ ] Segment by spend (high-value, low-value)
- [ ] Segment by visit frequency (weekly, monthly, quarterly)
- [ ] Segment by last visit date (overdue for rebooking)
- [ ] Segment by product purchases
- [ ] Segment by membership status
- [ ] Segment by referral source
- [ ] Segment by tag
- [ ] Segment export (for external marketing tools)
- [ ] Segment count preview before sending campaign

### 4.7 Client Data Management
- [ ] Merge duplicate client records
- [ ] Duplicate detection (auto-flag potential duplicates by name/email/phone)
- [ ] Bulk import from CSV / Excel
- [ ] Bulk import from another salon software (migration tool)
- [ ] Bulk export to CSV / Excel
- [ ] Individual client data export (GDPR data portability)
- [ ] Client data deletion (GDPR right to be forgotten)
- [ ] Data anonymization option
- [ ] Consent management dashboard (track opt-ins/opt-outs)
- [ ] Client blacklist / ban list

### 4.8 Loyalty & Retention
- [ ] Points-based loyalty program (earn points per visit/spend)
- [ ] Tiered loyalty levels (Bronze, Silver, Gold, Platinum)
- [ ] Points redemption for discounts or free services
- [ ] Loyalty card (digital stamp card)
- [ ] Referral program (reward clients for referring friends)
- [ ] Referral tracking (who referred whom, conversion tracking)
- [ ] Referral reward automation (auto-credit referrer when referee books)
- [ ] Birthday rewards (auto-send discount or free add-on)
- [ ] Anniversary rewards (years as a client)
- [ ] Win-back campaigns (target lapsed clients)
- [ ] Rebook prompts (remind clients when they're due for next visit)
- [ ] Client satisfaction surveys (post-visit)

---

## 5. Point of Sale (POS)

### 5.1 Checkout Flow
- [ ] Service checkout (from appointment)
- [ ] Product-only checkout (walk-in retail purchase)
- [ ] Combined service + product checkout
- [ ] Quick checkout from calendar (one-click on appointment)
- [ ] Multi-client checkout (checkout several appointments at once)
- [ ] Client self-checkout (via mobile link / kiosk)
- [ ] Itemized receipt display before payment
- [ ] Price override / manual price adjustment
- [ ] Line item notes

### 5.2 Payment Methods
- [ ] Credit / debit card (chip, swipe, tap)
- [ ] Cash
- [ ] Mobile wallets (Apple Pay, Google Pay, Samsung Pay)
- [ ] Gift card redemption
- [ ] Voucher redemption
- [ ] Package session redemption
- [ ] Membership credit redemption
- [ ] Client wallet / prepaid balance redemption
- [ ] Loyalty points redemption
- [ ] Split payment (multiple methods on one transaction)
- [ ] Split payment between multiple clients
- [ ] Payment links (send via SMS/email for remote payment)
- [ ] QR code payment
- [ ] Buy Now Pay Later (Klarna, Afterpay, Affirm)
- [ ] Check / other payment types
- [ ] Deposit application (deduct previously paid deposit)
- [ ] Account / charge to account (pay later)

### 5.3 Discounts & Promotions
- [ ] Percentage discount (per item or whole ticket)
- [ ] Fixed amount discount
- [ ] Promo code / coupon code entry
- [ ] Automatic discount application (membership discounts, loyalty tier discounts)
- [ ] First-visit discount
- [ ] Happy hour / off-peak pricing
- [ ] Bundle / package pricing
- [ ] Seasonal / time-limited promotions
- [ ] Staff discount
- [ ] Reason for discount (required field for tracking)

### 5.4 Tips & Gratuity
- [ ] Tip prompt during checkout (percentage presets: 15%, 20%, 25%)
- [ ] Custom tip amount
- [ ] Tip per provider (split tips across multiple providers in one appointment)
- [ ] Tip on card payment
- [ ] Cash tip recording
- [ ] Post-visit tipping (tip via payment link after leaving)
- [ ] Auto-gratuity option (for groups or certain services)
- [ ] Tip reporting (total tips per staff, per day, per period)

### 5.5 Gift Cards & Vouchers
- [ ] Sell physical gift cards
- [ ] Sell digital / e-gift cards
- [ ] Custom gift card amounts
- [ ] Pre-set gift card denominations
- [ ] Gift card with custom message
- [ ] Gift card delivery via email / SMS
- [ ] Gift card balance tracking
- [ ] Partial gift card redemption (remaining balance stays on card)
- [ ] Gift card expiration (configurable or no expiration)
- [ ] Gift card lookup by number
- [ ] Voucher creation (specific service vouchers, e.g. "Free Blowout")
- [ ] Promotional voucher distribution (bulk generate codes)
- [ ] Gift card sales reporting

### 5.6 Packages & Memberships at POS
- [ ] Sell service packages (e.g. "5 Massages for $400")
- [ ] Track package session usage (remaining sessions)
- [ ] Package expiration handling
- [ ] Sell memberships at checkout
- [ ] Membership auto-renewal billing
- [ ] Membership freeze / pause
- [ ] Membership cancellation with prorated refund
- [ ] Membership benefits auto-application (discounts, free services, priority booking)

### 5.7 Refunds & Adjustments
- [ ] Full refund (to original payment method)
- [ ] Partial refund
- [ ] Refund to store credit / client wallet
- [ ] Void transaction (before end of day)
- [ ] Exchange (product swap)
- [ ] Refund reason tracking
- [ ] Refund approval workflow (manager authorization)
- [ ] Credit notes / credit memos

### 5.8 Hardware & Receipts
- [ ] Receipt printing (thermal printer)
- [ ] Email receipt
- [ ] SMS receipt
- [ ] Gift receipt (no price shown)
- [ ] Receipt reprint / resend
- [ ] Cash drawer management (open, close, count)
- [ ] Cash drawer pay-in / pay-out tracking
- [ ] Daily cash drawer reconciliation / closeout
- [ ] Barcode scanner support (for product scanning)
- [ ] Card reader integration (Stripe Terminal, Square Reader, etc.)
- [ ] Kiosk mode (self-service check-in / checkout screen)
- [ ] iPad / tablet POS mode

### 5.9 Tax Handling
- [ ] Tax rate configuration (per location, per service type, per product type)
- [ ] Multiple tax rates (state, county, city)
- [ ] Tax-exempt items
- [ ] Tax-exempt clients
- [ ] Tax included in price vs. added on top
- [ ] Tax report generation

---

## 6. Staff Management

### 6.1 Staff Profiles
- [ ] Staff profile: name, email, phone, photo, bio
- [ ] Job title / role (stylist, colorist, esthetician, receptionist, manager, owner)
- [ ] Specialties / certifications
- [ ] Services they can perform (service-provider mapping)
- [ ] Employment type (full-time, part-time, contractor, booth renter)
- [ ] Start date / end date
- [ ] Staff profile visible on booking page (toggle)
- [ ] Staff booking page URL (individual booking link)
- [ ] Display order on booking page

### 6.2 Scheduling
- [ ] Working hours per staff member (per day of week)
- [ ] Custom schedules (different hours different weeks)
- [ ] Recurring schedule patterns
- [ ] Time-off requests (submit, approve, deny)
- [ ] Time-off calendar (see all staff time-off at a glance)
- [ ] Vacation / PTO tracking (accrual, balance)
- [ ] Sick leave tracking
- [ ] Break scheduling (lunch breaks, short breaks)
- [ ] Break duration rules (e.g. 30-min lunch after 6 hours)
- [ ] Split shifts (morning + evening with gap)
- [ ] Schedule templates (apply common patterns quickly)
- [ ] Schedule publishing (publish finalized schedule to staff)
- [ ] Schedule notifications (alert staff of schedule changes)
- [ ] Shift swapping between staff (request and approve)
- [ ] Multi-location scheduling (staff works at different locations on different days)
- [ ] Availability exceptions (one-off changes to regular schedule)

### 6.3 Clock-In / Clock-Out
- [ ] Clock-in / clock-out (via app, tablet, or desktop)
- [ ] PIN-based clock-in (prevent buddy punching)
- [ ] GPS / location-based clock-in verification
- [ ] Timesheet auto-generation from clock data
- [ ] Timesheet editing / correction (with manager approval)
- [ ] Overtime tracking and alerts
- [ ] Late arrival tracking
- [ ] Early departure tracking

### 6.4 Compensation & Payroll
- [ ] Hourly rate configuration
- [ ] Salary configuration
- [ ] Commission on services (percentage or flat per service)
- [ ] Tiered commission (higher percentage at higher revenue thresholds)
- [ ] Commission on product sales
- [ ] Commission on membership sales
- [ ] Commission on package sales
- [ ] Tip tracking and payout
- [ ] Bonus configuration (performance bonuses)
- [ ] Payroll report generation (hours + commission + tips)
- [ ] Payroll integration (Gusto, ADP, etc.)
- [ ] Payroll export (CSV for external payroll provider)
- [ ] Booth rental fee tracking
- [ ] Backbar / product usage deduction

### 6.5 Performance & Goals
- [ ] Individual KPI dashboard (revenue, clients served, rebooking rate, avg ticket)
- [ ] Performance goals (monthly revenue target, rebooking target)
- [ ] Goal progress tracking (visual progress bars)
- [ ] Leaderboard / ranking (gamification)
- [ ] Performance reviews (periodic evaluations)
- [ ] Utilization rate tracking (booked hours / available hours)
- [ ] Client retention rate per staff member
- [ ] Average rating per staff member (from reviews)
- [ ] New vs. returning client ratio per staff

### 6.6 Permissions & Roles
- [ ] Role-based access control (Owner, Manager, Staff, Receptionist, Viewer)
- [ ] Custom roles with granular permissions
- [ ] Permission categories: calendar, clients, POS, reports, settings, marketing, inventory, staff
- [ ] Data visibility restrictions (staff sees only their own clients/schedule)
- [ ] POS restrictions (who can give discounts, process refunds, void transactions)
- [ ] Report access restrictions
- [ ] Client data access restrictions
- [ ] Financial data access restrictions
- [ ] Settings edit restrictions
- [ ] Multi-location permission scoping

---

## 7. Inventory Management

### 7.1 Product Catalog
- [ ] Product name, description, SKU, barcode
- [ ] Product photo
- [ ] Product category / brand
- [ ] Retail price
- [ ] Cost price (wholesale / supplier cost)
- [ ] Margin calculation (automatic)
- [ ] Tax category per product
- [ ] Product variants (size, color -- e.g. shampoo 8oz vs 16oz)
- [ ] Product bundles (sell multiple products as a set)
- [ ] Active / inactive toggle (hide from POS without deleting)

### 7.2 Stock Management
- [ ] Current stock level tracking (per product, per location)
- [ ] Low-stock alerts (configurable threshold per product)
- [ ] Out-of-stock alerts
- [ ] Stock adjustment (manual add/remove with reason)
- [ ] Stock transfer between locations
- [ ] Backbar / professional use tracking (products used during services, not sold)
- [ ] Backbar cost per service calculation
- [ ] Automatic stock deduction on sale
- [ ] Automatic backbar deduction on service completion
- [ ] Stock take / physical inventory count
- [ ] Stock take variance report (expected vs. counted)
- [ ] Batch / lot tracking (for products with expiration dates)
- [ ] Expiration date tracking

### 7.3 Purchase Orders & Suppliers
- [ ] Supplier directory (name, contact, terms, lead time)
- [ ] Purchase order creation
- [ ] Auto-generate purchase orders from low-stock items
- [ ] Purchase order approval workflow
- [ ] Purchase order sending (email to supplier)
- [ ] Receive goods against purchase order (partial or full)
- [ ] Purchase order history
- [ ] Supplier price lists
- [ ] Multi-supplier product sourcing (same product from different suppliers)
- [ ] Reorder point / reorder quantity configuration per product
- [ ] Suggested reorder based on sales velocity

### 7.4 Barcode & Scanning
- [ ] Barcode generation for products
- [ ] Barcode label printing
- [ ] Barcode scanning for POS checkout
- [ ] Barcode scanning for stock take
- [ ] Barcode scanning for receiving goods
- [ ] QR code support

### 7.5 Inventory Reports
- [ ] Stock value report (total inventory value at cost and retail)
- [ ] Stock movement report (in/out per product over time)
- [ ] Best-selling products report
- [ ] Slow-moving / dead stock report
- [ ] Shrinkage report (discrepancies)
- [ ] Supplier spend report
- [ ] Margin report (profit per product)
- [ ] Cost of goods sold (COGS) report
- [ ] Reorder report (what needs to be reordered)
- [ ] Backbar usage report (professional product consumption)

---

## 8. Marketing

### 8.1 Email Marketing
- [ ] Email campaign builder (drag-and-drop or template-based)
- [ ] Pre-designed email templates (professional, salon-themed)
- [ ] Custom HTML email support
- [ ] Audience segmentation for targeting
- [ ] Personalization tokens (client name, last service, etc.)
- [ ] Schedule send (send at specific date/time)
- [ ] A/B testing (subject line, content variants)
- [ ] Email analytics (open rate, click rate, unsubscribe rate)
- [ ] Unsubscribe management (auto-honor opt-outs)
- [ ] Email deliverability monitoring

### 8.2 SMS Marketing
- [ ] SMS campaign builder
- [ ] Bulk SMS sending
- [ ] SMS character count and segment tracking
- [ ] SMS personalization tokens
- [ ] Two-way SMS (client replies visible, respondable)
- [ ] SMS opt-in management (TCPA compliance)
- [ ] SMS analytics (delivery rate, response rate)
- [ ] MMS support (send images via text)
- [ ] SMS short code or dedicated number

### 8.3 Automated Marketing (Triggers)
- [ ] Welcome message (after first booking or first visit)
- [ ] Thank-you message (after each visit)
- [ ] Birthday message (with offer/discount)
- [ ] Anniversary message (client anniversary with salon)
- [ ] Rebooking reminder (X days after last visit, no future booking)
- [ ] Lapsed client win-back (no visit in X days/weeks/months)
- [ ] No-show follow-up message
- [ ] Last-minute cancellation follow-up
- [ ] Review request (after appointment completion)
- [ ] Product repurchase reminder (X days after buying consumable product)
- [ ] Membership renewal reminder
- [ ] Package expiration reminder
- [ ] Gift card balance reminder
- [ ] Seasonal campaign automation (holiday promotions)
- [ ] Drip campaigns (multi-step automated sequences)

### 8.4 Promotions & Deals
- [ ] Percentage-off deals
- [ ] Dollar-off deals
- [ ] BOGO (Buy One Get One)
- [ ] Flash sales (time-limited)
- [ ] Happy hour pricing (off-peak discounts)
- [ ] First-time client special
- [ ] Refer-a-friend deal
- [ ] Bundle deals (service + product combo discount)
- [ ] Seasonal promotions
- [ ] Promo code generation
- [ ] Promo code usage tracking and limits
- [ ] Auto-expiring promotions

### 8.5 Social Media & Online Presence
- [ ] Instagram integration ("Book Now" button, post scheduling)
- [ ] Facebook integration ("Book Now" button, page management)
- [ ] Google Business Profile integration
- [ ] Social media post templates
- [ ] Photo sharing to social media from client gallery
- [ ] Online listing on marketplace (Fresha, Vagaro, Mindbody marketplace)
- [ ] Website builder / microsite (basic booking website)
- [ ] Blog / content section
- [ ] SEO optimization for booking page

### 8.6 Referral Program
- [ ] Referral link generation per client
- [ ] Referral tracking (who referred whom)
- [ ] Referrer reward (discount, credit, free service)
- [ ] Referee reward (first-visit discount)
- [ ] Referral conversion tracking
- [ ] Referral leaderboard
- [ ] Automated referral reward fulfillment

---

## 9. Reporting & Analytics

### 9.1 Financial Reports
- [ ] Revenue summary (daily, weekly, monthly, quarterly, yearly)
- [ ] Revenue by service
- [ ] Revenue by service category
- [ ] Revenue by staff member
- [ ] Revenue by location
- [ ] Revenue by payment method
- [ ] Revenue by booking source (online, walk-in, phone)
- [ ] Gross profit report
- [ ] Net profit report (after expenses)
- [ ] Tax collected report
- [ ] Sales tax report (for filing)
- [ ] Accounts receivable (outstanding balances)
- [ ] Refund report
- [ ] Discount report (total discounts given, by type, by staff)
- [ ] Gift card liability report (outstanding unredeemed gift cards)
- [ ] Daily / shift closeout report (end-of-day summary)
- [ ] Cash reconciliation report
- [ ] Tips report
- [ ] Expense tracking / report

### 9.2 Appointment Reports
- [ ] Total appointments (by period)
- [ ] Appointments by status (completed, no-show, cancelled, rescheduled)
- [ ] No-show rate (overall, by staff, by service)
- [ ] Cancellation rate (overall, by staff, by service, by notice period)
- [ ] Rebooking rate (% of clients who rebook before leaving)
- [ ] Booking lead time (how far in advance clients book)
- [ ] Booking source breakdown (online %, walk-in %, phone %)
- [ ] Peak hours analysis (busiest times of day/week)
- [ ] Utilization rate (booked time / available time per staff)
- [ ] Average appointment duration
- [ ] Schedule gap analysis
- [ ] Waitlist conversion report

### 9.3 Client Reports
- [ ] Total clients (active, new, returning, lapsed)
- [ ] New client acquisition (by period, by source)
- [ ] Client retention rate (overall, by staff)
- [ ] Client lifetime value (CLV)
- [ ] Average spend per visit
- [ ] Visit frequency distribution
- [ ] Client demographics (age, gender, location)
- [ ] Top clients by revenue
- [ ] At-risk clients (overdue for rebooking)
- [ ] Client satisfaction scores (from surveys/reviews)
- [ ] Referral report (referrals generated, converted)

### 9.4 Staff Reports
- [ ] Staff revenue ranking
- [ ] Staff utilization rate
- [ ] Staff rebooking rate
- [ ] Staff retention rate (their clients' return rate)
- [ ] Staff average ticket value
- [ ] Staff service count
- [ ] Staff product sales
- [ ] Staff commission earned
- [ ] Staff tips earned
- [ ] Staff hours worked
- [ ] Staff punctuality report
- [ ] Staff goal attainment

### 9.5 Product / Inventory Reports
- [ ] Product sales report (units sold, revenue)
- [ ] Product sales by category
- [ ] Product sales by staff (who sells the most retail)
- [ ] Best-selling products
- [ ] Slow-moving products
- [ ] Inventory value report
- [ ] COGS report
- [ ] Margin report
- [ ] Stock movement report
- [ ] Shrinkage / loss report
- [ ] Backbar consumption report

### 9.6 Marketing Reports
- [ ] Campaign performance (opens, clicks, conversions, revenue attributed)
- [ ] SMS campaign performance
- [ ] Email campaign performance
- [ ] Promotion redemption report
- [ ] Referral program performance
- [ ] Loyalty program performance (points issued, redeemed, liability)
- [ ] Client acquisition cost
- [ ] Marketing ROI

### 9.7 Report Features
- [ ] Custom date range selector
- [ ] Date presets (today, this week, this month, this quarter, this year, last month, etc.)
- [ ] Comparison periods (this month vs. last month, this year vs. last year)
- [ ] Data visualization (charts, graphs, sparklines, heatmaps)
- [ ] Real-time dashboard (live updating numbers)
- [ ] Report export to CSV
- [ ] Report export to PDF
- [ ] Report export to Excel (XLSX)
- [ ] Scheduled report delivery (email daily/weekly/monthly reports)
- [ ] Report favoriting / pinning
- [ ] Custom report builder (select your own metrics and dimensions)
- [ ] Report sharing (share link with managers/owners)
- [ ] Drill-down capability (click on summary to see details)
- [ ] KPI alerts (notify when metric crosses threshold)

---

## 10. Payments & Financial

### 10.1 Payment Processing
- [ ] Integrated payment processing (built-in, not third-party redirect)
- [ ] PCI DSS Level 1 compliance
- [ ] EMV chip card support
- [ ] Contactless / NFC payment
- [ ] Magnetic stripe (swipe) support
- [ ] Manual card entry (card not present)
- [ ] Recurring billing (memberships, subscriptions)
- [ ] Automatic failed payment retry
- [ ] Automatic card updater (update expired cards)
- [ ] Instant payout option (same-day access to funds)
- [ ] Next-day standard payout
- [ ] Competitive processing rates (transparent pricing)
- [ ] Chargeback management / dispute handling
- [ ] Payment receipt generation

### 10.2 Deposits & Holds
- [ ] Pre-authorization (hold amount on card without charging)
- [ ] Deposit collection at booking
- [ ] Configurable deposit amounts (per service, global)
- [ ] Deposit auto-deduction at checkout
- [ ] Cancellation fee charging (auto-charge saved card)
- [ ] No-show fee charging

### 10.3 Invoicing
- [ ] Invoice generation (for B2B, corporate clients)
- [ ] Invoice customization (logo, terms, line items)
- [ ] Invoice sending via email
- [ ] Invoice payment tracking (paid, unpaid, overdue)
- [ ] Recurring invoices
- [ ] Invoice numbering (sequential, custom prefix)
- [ ] Credit notes / refund invoices

### 10.4 Multi-Currency & Multi-Location Finance
- [ ] Multi-currency support
- [ ] Currency auto-detection by location
- [ ] Multi-location financial consolidation
- [ ] Per-location tax configuration
- [ ] Per-location pricing
- [ ] Inter-location transfers (gift card usable at any location)

### 10.5 Accounting Integration
- [ ] QuickBooks Online integration (auto-sync transactions)
- [ ] QuickBooks Desktop integration
- [ ] Xero integration
- [ ] FreshBooks integration
- [ ] General ledger export
- [ ] Chart of accounts mapping
- [ ] Automatic journal entries
- [ ] End-of-month / end-of-year reconciliation support

---

## 11. Notifications & Communications

### 11.1 Transactional Notifications
- [ ] Booking confirmation (email, SMS, push, WhatsApp)
- [ ] Booking modification notification (to client and staff)
- [ ] Booking cancellation notification
- [ ] Appointment reminder (configurable timing: 48h, 24h, 2h)
- [ ] Staff appointment notification (new booking assigned to them)
- [ ] Waitlist slot available notification
- [ ] Payment confirmation (receipt)
- [ ] Refund confirmation
- [ ] Membership renewal notification
- [ ] Membership payment failed notification
- [ ] Package expiration warning
- [ ] Gift card purchase confirmation (to buyer and recipient)

### 11.2 Operational Notifications
- [ ] New online booking alert (to staff/reception)
- [ ] Walk-in client check-in alert
- [ ] Client arrived notification (to provider)
- [ ] Running late alert (client is late, notify staff)
- [ ] Schedule change notification (shift changed by manager)
- [ ] Time-off request notification (to manager)
- [ ] Time-off approval notification (to staff)
- [ ] Low stock alert (to manager)
- [ ] Daily schedule summary (morning email to each staff member)
- [ ] End-of-day summary (revenue, appointments, tips)

### 11.3 Communication Channels
- [ ] Email (transactional + marketing)
- [ ] SMS (transactional + marketing)
- [ ] Push notifications (PWA / mobile app)
- [ ] WhatsApp Business integration
- [ ] In-app messages / notifications center
- [ ] Two-way SMS messaging (live conversation)
- [ ] Two-way email messaging
- [ ] Two-way WhatsApp messaging
- [ ] Web chat (live chat on booking page)
- [ ] Phone integration (VoIP, call routing, call logging)
- [ ] Voicemail transcription
- [ ] Call recording

### 11.4 Notification Management
- [ ] Client notification preferences (opt-in/opt-out per channel)
- [ ] Notification templates (customizable text per notification type)
- [ ] Template variables / merge tags
- [ ] Multi-language notification templates
- [ ] Notification log / history (see what was sent to whom and when)
- [ ] Delivery status tracking (sent, delivered, opened, bounced, failed)
- [ ] Quiet hours configuration (don't send SMS at 3am)
- [ ] Notification throttling (prevent spam)

---

## 12. Reviews & Reputation

### 12.1 Review Collection
- [ ] Automated review request after appointment (email)
- [ ] Automated review request after appointment (SMS)
- [ ] Customizable review request timing (e.g. 2 hours after, next day)
- [ ] Internal review form (star rating + text feedback)
- [ ] NPS (Net Promoter Score) survey
- [ ] Service-specific rating
- [ ] Staff-specific rating
- [ ] Photo upload with review
- [ ] Anonymous feedback option

### 12.2 Review Management
- [ ] Review dashboard (see all reviews in one place)
- [ ] Review filtering (by rating, by staff, by service, by date)
- [ ] Review response / reply (internal response to client)
- [ ] Negative review alerts (instant notification for 1-3 star reviews)
- [ ] Review moderation (approve before publishing)
- [ ] Flag / report inappropriate reviews
- [ ] Review analytics (average rating over time, sentiment trends)
- [ ] "Needs Reply" filter (track unresponded reviews)

### 12.3 External Review Integration
- [ ] Google Reviews integration (redirect happy clients to Google)
- [ ] Google Reviews aggregation (show Google reviews in dashboard)
- [ ] Yelp review monitoring
- [ ] Facebook review monitoring
- [ ] Review gating (route unhappy clients to private feedback, happy clients to public review)
- [ ] Review widget (display reviews on booking page / website)
- [ ] Review badge / summary on booking page (average rating, total reviews)

### 12.4 Testimonials & Social Proof
- [ ] Testimonial display on booking page
- [ ] Star rating display on booking page
- [ ] Review count display
- [ ] Staff-specific rating display on their booking profile
- [ ] Before/after gallery on booking page

---

## 13. Settings & Configuration

### 13.1 Business Settings
- [ ] Business name, address, phone, email, website
- [ ] Business logo upload
- [ ] Multiple location management
- [ ] Per-location settings (hours, staff, services, pricing)
- [ ] Business hours (per day of week, per location)
- [ ] Special hours / holiday hours
- [ ] Holiday calendar (business closures)
- [ ] Auto-close on holidays (block bookings)

### 13.2 Booking Policy Settings
- [ ] Cancellation policy text (displayed during booking)
- [ ] Cancellation window (how far in advance client must cancel)
- [ ] No-show fee amount
- [ ] Late cancellation fee amount
- [ ] Deposit requirements (global and per-service)
- [ ] Minimum booking lead time
- [ ] Maximum advance booking window
- [ ] Same-day booking toggle
- [ ] Overbooking rules
- [ ] Buffer time defaults
- [ ] Processing time defaults
- [ ] Booking confirmation mode (auto-confirm vs. pending approval)

### 13.3 Tax & Currency Settings
- [ ] Tax rate configuration (multiple rates)
- [ ] Tax name (Sales Tax, VAT, GST, etc.)
- [ ] Tax rules (which products/services are taxable)
- [ ] Tax-inclusive vs. tax-exclusive pricing
- [ ] Currency selection
- [ ] Currency display format (symbol, decimal places)
- [ ] Fiscal year start month

### 13.4 Branding & Customization
- [ ] Brand colors (primary, secondary, accent)
- [ ] Logo (for booking page, receipts, emails)
- [ ] Favicon
- [ ] Custom booking page URL (subdomain or custom domain)
- [ ] Email template branding (logo, colors, footer)
- [ ] SMS sender name
- [ ] Receipt customization (logo, header/footer text)
- [ ] Booking page cover photo / gallery
- [ ] Custom CSS injection (advanced branding)

### 13.5 Custom Fields
- [ ] Custom fields for clients (unlimited)
- [ ] Custom fields for appointments
- [ ] Custom fields for services
- [ ] Custom fields for products
- [ ] Field types: text, number, date, dropdown, checkbox, file upload, signature
- [ ] Required vs. optional fields
- [ ] Visibility rules (show in booking, show in checkout, internal only)

### 13.6 Notification Settings
- [ ] Enable/disable each notification type
- [ ] Customize notification content (templates)
- [ ] Reminder timing configuration
- [ ] Notification channel selection (email, SMS, both)
- [ ] Staff notification preferences
- [ ] Client-facing notification language

### 13.7 Data & Import/Export
- [ ] Data import wizard (clients, services, products, appointments)
- [ ] Data export (all data types)
- [ ] Data migration from competitor software
- [ ] API access (for custom integrations)
- [ ] Webhook configuration (event-based integrations)
- [ ] Backup / data download (full account data export)

---

## 14. Security & Compliance

### 14.1 Authentication & Access
- [ ] Email + password login
- [ ] Social login (Google, Apple, Facebook)
- [ ] Two-factor authentication (2FA) -- SMS, authenticator app
- [ ] Single sign-on (SSO) for enterprise
- [ ] Session timeout configuration
- [ ] Password complexity requirements
- [ ] Account lockout after failed attempts
- [ ] Password reset flow (secure, time-limited tokens)
- [ ] Magic link login (passwordless)

### 14.2 Data Security
- [ ] Data encryption at rest (AES-256)
- [ ] Data encryption in transit (TLS 1.3)
- [ ] PCI DSS compliance (payment card data)
- [ ] HIPAA compliance (for medical spas -- BAA available)
- [ ] SOC 2 Type II certification
- [ ] Regular security audits / penetration testing
- [ ] Secure file storage (photos, documents, forms)
- [ ] Credit card tokenization (never store raw card numbers)
- [ ] Database backups (automated, encrypted)
- [ ] Disaster recovery plan

### 14.3 Privacy & GDPR
- [ ] Privacy policy display and acceptance
- [ ] Cookie consent management
- [ ] Data processing agreement (DPA)
- [ ] Client data access request fulfillment (right of access)
- [ ] Client data deletion request fulfillment (right to erasure)
- [ ] Client data portability (export in machine-readable format)
- [ ] Consent tracking (what each client consented to, when)
- [ ] Marketing opt-in/opt-out management
- [ ] Data retention policies (auto-delete old data)
- [ ] Data anonymization capabilities
- [ ] Sub-processor list (third parties who process data)

### 14.4 Audit & Compliance
- [ ] Audit log (who did what, when -- all actions logged)
- [ ] Audit log filtering and search
- [ ] Audit log export
- [ ] Login history tracking
- [ ] IP address logging
- [ ] Failed login attempt logging
- [ ] Data change tracking (before/after values)
- [ ] Compliance dashboard (overview of compliance status)
- [ ] Regulatory compliance documentation

---

## 15. Mobile Experience

### 15.1 Responsive Design
- [ ] Fully responsive web app (works on all screen sizes)
- [ ] Mobile-optimized calendar (touch-friendly, swipe gestures)
- [ ] Mobile-optimized checkout
- [ ] Mobile-optimized client management
- [ ] Mobile-optimized reports (simplified views)
- [ ] Bottom navigation on mobile
- [ ] Floating action button (FAB) for quick actions
- [ ] Pull-to-refresh
- [ ] Swipe actions (swipe to call, swipe to message)

### 15.2 Progressive Web App (PWA)
- [ ] Installable to home screen (Add to Home Screen prompt)
- [ ] App icon and splash screen
- [ ] Offline support (view schedule, client info when offline)
- [ ] Background sync (queue actions while offline, sync when back online)
- [ ] Push notifications (even when app is closed)
- [ ] Service worker caching (fast load times)
- [ ] App-like navigation (no browser chrome)
- [ ] Automatic updates (no app store update needed)

### 15.3 Native Mobile App (Optional)
- [ ] iOS app (App Store)
- [ ] Android app (Google Play)
- [ ] Push notifications (native)
- [ ] Camera access (for photo capture)
- [ ] Barcode scanner (via camera)
- [ ] Biometric login (Face ID, fingerprint)
- [ ] Offline mode
- [ ] Apple Watch / WearOS companion (optional)

### 15.4 Client-Facing Mobile
- [ ] Client mobile booking (mobile-optimized booking flow)
- [ ] Client app / portal (view appointments, rebook, pay, leave reviews)
- [ ] Client check-in via phone (QR code or link)
- [ ] Client self-checkout via phone
- [ ] Client loyalty card on phone (digital stamp card)
- [ ] Push notifications for clients (reminders, promotions)

---

## 16. Integrations

### 16.1 Calendar Integrations
- [ ] Google Calendar sync (two-way)
- [ ] Apple Calendar / iCal sync
- [ ] Outlook / Microsoft 365 Calendar sync
- [ ] .ics file export

### 16.2 Payment Integrations
- [ ] Stripe
- [ ] Square
- [ ] PayPal
- [ ] Adyen
- [ ] Worldpay
- [ ] Klarna / Afterpay / Affirm (BNPL)
- [ ] Stripe Terminal (card reader hardware)
- [ ] Square Terminal / Reader

### 16.3 Accounting Integrations
- [ ] QuickBooks Online
- [ ] QuickBooks Desktop
- [ ] Xero
- [ ] FreshBooks
- [ ] Wave
- [ ] MYOB
- [ ] Sage

### 16.4 Marketing & Communication Integrations
- [ ] Mailchimp
- [ ] Klaviyo
- [ ] Constant Contact
- [ ] Twilio (SMS)
- [ ] SendGrid (email)
- [ ] WhatsApp Business API
- [ ] Meta (Facebook + Instagram)
- [ ] Google Business Profile
- [ ] TikTok (future)

### 16.5 CRM & Productivity Integrations
- [ ] Zapier (connects to 5000+ apps)
- [ ] Make (Integromat)
- [ ] Google Sheets
- [ ] Slack (notifications)
- [ ] Microsoft Teams
- [ ] HubSpot
- [ ] Salesforce (for enterprise)

### 16.6 Website & E-Commerce
- [ ] WordPress plugin / widget
- [ ] Squarespace embed
- [ ] Wix embed
- [ ] Shopify integration (for retail products)
- [ ] Custom website embed (JavaScript widget)
- [ ] API (REST or GraphQL) for custom development
- [ ] Webhooks (event-driven integrations)
- [ ] White-label / custom-branded app

### 16.7 Health & Compliance Integrations
- [ ] Telehealth / video (Zoom, proprietary)
- [ ] EMR / EHR integration (for medical spas)
- [ ] Insurance billing integration (for medical services)
- [ ] Digital consent / e-signature (DocuSign, built-in)

### 16.8 Hardware Integrations
- [ ] Receipt printers (Star, Epson)
- [ ] Cash drawers
- [ ] Barcode scanners
- [ ] Card readers (Stripe Terminal, Square Reader, Verifone)
- [ ] Check-in kiosk / tablet
- [ ] Door / access control (for gyms, spas with restricted areas)

---

## 17. AI & Automation (2026 Table Stakes)

### 17.1 AI Front Desk / Receptionist
- [ ] AI chatbot on booking page (answer FAQs, guide booking)
- [ ] AI phone answering (handle calls when staff is busy)
- [ ] AI SMS responder (answer common questions via text)
- [ ] AI-driven appointment booking via chat/voice
- [ ] AI rescheduling assistant
- [ ] AI cancellation handling

### 17.2 Smart Scheduling
- [ ] AI-optimized scheduling (minimize gaps, maximize utilization)
- [ ] Smart gap-filling suggestions (recommend times that fill calendar gaps)
- [ ] Demand prediction (predict busy/slow periods)
- [ ] Dynamic pricing (auto-adjust prices based on demand)
- [ ] Staff allocation optimization (suggest staffing levels)
- [ ] No-show prediction (flag high-risk appointments)
- [ ] Auto-overbooking (based on predicted no-show rate)

### 17.3 AI Marketing
- [ ] AI-generated marketing copy (email, SMS content)
- [ ] AI-recommended audience segments
- [ ] Send time optimization (AI picks best time to send)
- [ ] AI product recommendations (suggest products to clients)
- [ ] AI service recommendations (suggest services based on history)
- [ ] Churn prediction (identify clients likely to leave)
- [ ] AI-powered win-back timing

### 17.4 AI Analytics
- [ ] AI business insights (natural language summaries of performance)
- [ ] Conversational analytics ("How did revenue compare to last month?")
- [ ] Anomaly detection (flag unusual patterns in revenue, no-shows, etc.)
- [ ] Predictive revenue forecasting
- [ ] AI-powered staff performance insights

### 17.5 AI Content & Personalization
- [ ] AI-generated social media posts
- [ ] AI-generated responses to reviews
- [ ] AI photo enhancement (before/after photo improvement)
- [ ] Personalized booking experience (show services based on client history)
- [ ] AI appointment notes summarization

---

## 18. Multi-Location & Enterprise

### 18.1 Multi-Location Management
- [ ] Centralized dashboard (see all locations at a glance)
- [ ] Per-location configuration (hours, services, pricing, tax, staff)
- [ ] Cross-location client profiles (client recognized at any location)
- [ ] Cross-location gift card redemption
- [ ] Cross-location membership usage
- [ ] Cross-location reporting (consolidated and per-location)
- [ ] Location comparison reports
- [ ] Inventory transfers between locations
- [ ] Staff scheduling across locations (float staff)
- [ ] Location selector in booking (client picks nearest/preferred)

### 18.2 Franchise / Enterprise
- [ ] Corporate vs. franchise permission hierarchy
- [ ] Brand-level settings (enforced across all locations)
- [ ] Location-level overrides (within corporate guardrails)
- [ ] Centralized marketing campaigns (push to all locations)
- [ ] Franchise royalty / fee tracking
- [ ] Corporate reporting roll-up
- [ ] SSO for enterprise
- [ ] Custom SLA / support tier
- [ ] Dedicated account manager
- [ ] API access for enterprise integrations
- [ ] White-label option (remove platform branding)

---

## 19. Onboarding & Support

### 19.1 Onboarding
- [ ] Guided setup wizard (step-by-step business configuration)
- [ ] Sample data (demo appointments, clients, services to explore)
- [ ] Data migration assistance (import from previous software)
- [ ] Video tutorials / academy
- [ ] Interactive product tour (tooltips, walkthrough)
- [ ] Onboarding checklist (setup progress tracker)
- [ ] Template libraries (services, forms, emails -- pre-built for salon/spa)

### 19.2 Help & Support
- [ ] Help center / knowledge base
- [ ] In-app contextual help (help icon next to features)
- [ ] Live chat support
- [ ] Email support
- [ ] Phone support
- [ ] Community forum
- [ ] Feature request board (vote on features)
- [ ] Status page (uptime monitoring)
- [ ] Changelog / release notes (what's new)
- [ ] Webinars / live training sessions

---

## Summary Statistics

| Category | Sub-features |
|----------|-------------|
| 1. Core Booking Engine | 48 |
| 2. Online Booking | 82 |
| 3. Calendar | 52 |
| 4. Client Management | 104 |
| 5. Point of Sale | 86 |
| 6. Staff Management | 73 |
| 7. Inventory | 46 |
| 8. Marketing | 60 |
| 9. Reporting & Analytics | 86 |
| 10. Payments & Financial | 39 |
| 11. Notifications & Communications | 48 |
| 12. Reviews & Reputation | 28 |
| 13. Settings & Configuration | 50 |
| 14. Security & Compliance | 39 |
| 15. Mobile Experience | 31 |
| 16. Integrations | 42 |
| 17. AI & Automation | 27 |
| 18. Multi-Location & Enterprise | 21 |
| 19. Onboarding & Support | 18 |
| **TOTAL** | **~980** |

---

## Competitor Feature Matrix (Key Differentiators)

| Feature | Fresha | Vagaro | Mindbody | Boulevard | Square | Booksy | GlossGenius | Zenoti | Phorest | Mangomint | Acuity |
|---------|--------|--------|----------|-----------|--------|--------|-------------|--------|---------|-----------|--------|
| Free tier | No | No | No | No | Yes | No | No | No | No | No | No |
| Marketplace/Discovery | Yes | Yes | Yes | No | Yes | Yes | No | No | No | No | No |
| AI Receptionist | No | Yes | Yes | No | No | No | Yes | Yes | No | No | No |
| Precision Scheduling (AI) | No | No | No | Yes | No | Yes | No | Yes | No | No | No |
| Two-way messaging (all channels) | 2026 | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| HIPAA compliance | No | Yes | No | Yes | No | No | No | Yes | No | Yes | No |
| SOAP notes | No | Yes | No | No | No | No | No | Yes | No | Yes | No |
| Integrated payroll | No | Gusto | No | No | No | No | Yes | Yes | No | Yes | No |
| Dynamic pricing | No | No | No | No | No | No | No | Yes | No | No | No |
| Multi-location | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Native mobile app (staff) | No | Yes | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | No |
| Client marketplace app | Yes | Yes | Yes | No | No | Yes | No | No | No | No | No |
| White label client app | No | No | Yes | No | No | No | No | Yes | Yes | No | No |
| Drag-to-resize calendar | Yes | Yes | Yes | Yes | No | No | No | Yes | No | Yes | No |
| Resource management (rooms) | Yes | Yes | Yes | Yes | No | No | No | Yes | Yes | Yes | Yes |
| Loyalty program | Yes | Yes | Yes | No | Yes | Yes | No | Yes | Yes | No | No |
| Gift cards | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Memberships | Yes | Yes | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | No |
| Inventory + PO | Yes | Yes | Yes | Yes | No | No | Yes | Yes | Yes | Yes | No |

---

*Generated 2026-02-20. Based on published feature lists, help centers, reviews, and documentation from all major competitors.*
