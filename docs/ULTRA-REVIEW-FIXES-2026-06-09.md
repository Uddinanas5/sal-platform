# Ultra Review Fixes — 2026-06-09

Source: 9-dimension multi-agent ultra review (90 agents, adversarial verification).
79 confirmed findings (34 high / 32 medium / 13 low), 2 rejected. Deduped to ~60 canonical units below.
Baseline before fixes: typecheck ✅ lint ✅ tests ✅ build ✅.

Branch: `fix/security-tenancy-honesty` (origin/main + prior security commit 8d7c99d).

## OUTCOME (2026-06-10)

All batches landed in 8 commits on this branch. **Every batch gate green: typecheck +
lint + 397 tests (under TZ=UTC and TZ=America/New_York) + production build.**
~55 of the ~60 canonical units fixed; the rest are migration-gated (below).

Notable: walk-in commissions now record (the original "$0 commission" bug), checkout
double-ring-up closed, configured tax/currency honored, OAuth staff→admin escalation
closed, same-day booking fixed on the UTC host, reports/dashboards bucket on the salon
clock, and the fake-UI sweep made controls real or honestly "coming soon". Two features
the honesty pass had to disable were upgraded to genuinely working: **Add Product** and
**staff activate/deactivate**.

### DEFERRED — need a Prisma migration + prod deploy (NOT applied this session)
These have non-migration mitigations in place (advisory locks / deletedAt filters); the
unique constraints are the hard backstops and require `prisma migrate deploy` on the prod
DB with the 6 real businesses:
- D3: `@@unique([businessId, periodStart, periodEnd])` on `payroll_periods`
  (mitigated by a per-business advisory lock in ensureOpenPayrollPeriod).
- D7: partial `UNIQUE (businessId, email) WHERE deletedAt IS NULL` on `clients`
  (mitigated by a deletedAt:null filter on the find-or-create).

### PARTIAL / follow-ups (low severity)
- Email HTML-escaping applied to the public-facing templates (booking confirmation,
  review request); the remaining transactional templates (cancel/reschedule/receipt)
  render stored names and should get the same `esc()` pass.
- P2 email escaping and the broader notification-template rendering remain as the
  email pipeline's coming-soon items.

## Batch 1 — Security / Tenancy
- [ ] S1 OAuth access tokens hardcode `role:"admin"` → privilege escalation (api/auth.ts:37) [HIGH]
- [ ] S2 User.role is global; cross-tenant role rewrite (invitations.ts) [HIGH]
- [ ] S3 v1/staff exposes colleague commission to staff role (api/v1/staff) [MED]
- [ ] S4 redeemGiftCard no role gate / no ledger (gift-cards.ts:120) [MED]
- [ ] S5 requestTimeOff for any colleague (staff.ts:140) [LOW]

## Batch 2 — Money / Checkout
- [ ] M1 Dashboard POS checkout never passes appointmentId → $0 commission + double ring-up (payment-dialog.tsx) [HIGH]
- [ ] M2 TOCTOU double-checkout: paid guard outside tx (checkout.ts / record-checkout.ts) [HIGH]
- [ ] M3 Commission written for ALL appt services regardless of what was sold (record-checkout.ts:375) [MED]
- [ ] M4 create-payment-intent trusts client amount, bypasses side-effects (stripe/create-payment-intent) [MED]
- [ ] M5 Account deletion never cancels Stripe subscription (account.ts:92) [MED]
- [ ] M6 Hardcoded USD currency + NYC tax fallback for every tenant (record-checkout.ts:401) [MED]
- [ ] M7 Payment settings (tax rate/name/tips) persisted but ignored at checkout (payments-settings-tab) [HIGH]
- [ ] M8 Subscription activation webhook lacks freshness guard (stripe/webhook:357) [LOW]

## Batch 3 — Booking
- [ ] B1 isSlotAvailable hardcodes 30-min lead time (availability.ts:292) [HIGH]
- [ ] B2 resizeAppointment corrupts multi-service appointments (appointments.ts:619/645) [MED]
- [ ] B3 Availability treats no_show as occupied; write path frees it (availability.ts:128) [LOW]
- [ ] B4 Availability assumes fixed 24h day (DST fall-back hour) (availability.ts:65) [LOW]

## Batch 4 — Timezone
- [ ] T1 /api/availability past-date guard uses server-UTC day (availability/route.ts:77) [HIGH]
- [ ] T2 Reports heatmap buckets by server-UTC hour/weekday (reports.ts:564) [HIGH]
- [ ] T3 Dashboard 'today' windowed on server-UTC day (queries/appointments.ts:88) [MED]
- [ ] T4 Reports date-range + revenue-by-day in server tz (reports.ts:28) [MED]
- [ ] T5 Waitlist past-date guard server-UTC (public-booking.ts:419) [MED]
- [ ] T6 Staff time-off renders one day early (staff-timeoff-tab.tsx:99) [MED]
- [ ] T7 v1/internal bookings date filters server-UTC (api/v1/appointments:46) [MED]
- [ ] T8 Manage-booking renders viewer-local tz (book/manage/[ref]/client.tsx:86) [MED]

## Batch 5 — Data Integrity
- [ ] D1 Inventory decrement: no ledger row, no zero floor (record-checkout.ts:492) [MED]
- [ ] D2 adjustStock non-transactional read-modify-write (products.ts:101) [MED]
- [ ] D3 Payroll-period bootstrap can duplicate/overlap (record-checkout.ts:117) [MED]
- [ ] D4 Campaign send TOCTOU double-send (send-core.ts:79) [MED]
- [ ] D5 Soft-deleted services attachable to new appts (appointments.ts:92) [MED]
- [ ] D6 Group booking capacity race oversell (recurring.ts:600) [MED]
- [ ] D7 Public booking client: no unique (businessId,email), no deletedAt filter (public-booking.ts:193) [MED]
- [ ] D8 Seed cleanup misses RESTRICT-FK tables (seed.ts:48) [LOW]

## Batch 6 — Honesty (make real or label coming-soon)
- [ ] H1 Settings Integrations tab fake (settings/client.tsx:762) [HIGH]
- [ ] H2 Settings Security tab inert (settings/client.tsx:824) [HIGH]
- [ ] H3 Upload Logo dead (settings/client.tsx:416) [HIGH]
- [ ] H4 Forms tab templates={[]} (settings/client.tsx:902) [HIGH]
- [ ] H5 Form-builder auto-send/required toggles inert (form-builder-dialog.tsx:405) [HIGH]
- [ ] H6 Booking Settings panel inert incl online ON/OFF (booking-settings.tsx:167) [HIGH]
- [ ] H7 Notification email-template editor inert (notifications-settings-tab.tsx:162) [HIGH]
- [ ] H8 Internal Alerts toggles control nothing (notifications-settings-tab.tsx:307) [HIGH]
- [ ] H9 Staff Adjust Rate commission dialog is a toast lie (staff-commission-tab.tsx:112) [HIGH]
- [ ] H10 Deals can't be redeemed + status enum mismatch (deals-tab.tsx:202) [HIGH]
- [ ] H11 Automated Messages 6/9 triggers inert (automated-messages-tab.tsx:264) [HIGH]
- [ ] H12 Create Campaign fake audience counts (create-campaign-dialog.tsx:38) [HIGH]
- [ ] H13 Reviews hardcoded 'Google' source + fake filters (queries/reviews.ts:52) [HIGH]
- [ ] H14 Settings language never saved (settings/client.tsx:510) [MED]
- [ ] H15 Notification bell view-all/read state (notification-dropdown.tsx:200) [MED]
- [ ] H16 Social links saved but displayed nowhere (online-presence-tab.tsx:392) [MED]
- [ ] H17 Campaign analytics permanently zero, shown as real (campaigns-tab.tsx:174) [MED]
- [ ] H18 Inventory Add Product fake (add-product-dialog.tsx:105) [HIGH]
- [ ] H19 Staff card active/inactive switch local-only (staff/client.tsx:169) [HIGH]
- [ ] H20 Payment dialog dismiss during processing → double record (payment-dialog.tsx:279) [HIGH]
- [ ] H21 Print receipt fake (payment-dialog.tsx:636) [HIGH]
- [ ] H22 Block Client not enforced (clients/[id]/client.tsx:139) [HIGH]
- [ ] H23 Public booking ignores requiredFields/customQuestions (public-booking.ts:66) [HIGH]

## Batch 7 — Frontend
- [ ] F1 Calendar never syncs with refreshed server data (calendar/client.tsx:132) [HIGH]
- [ ] F2 Edit Client DOB never saved (edit-client-dialog.tsx:78) [MED]
- [ ] F3 Add Client allergies not reset + double-submit (clients/client.tsx:678) [MED]
- [ ] F4 Service active switch no rollback on reject (services/client.tsx:96) [MED]
- [ ] F5 Public booking stale selections on service change (book/[slug]/client.tsx:1701) [MED]
- [ ] F7 Clients 'New' filter tag never set (clients/client.tsx:545) [LOW]
- [ ] F8 Division-by-zero $NaN (clients/client.tsx:607) [LOW]
- [ ] F9 Detail-sheet optimistic success toast before server (appointment-detail-sheet.tsx:210) [LOW]
- [ ] F10 Services inert drag handle / dead empty-state button (services/client.tsx:123) [LOW]

## Batch 8 — Public Flow
- [ ] P1 OG image 404 + wrong metadataBase (layout.tsx:34) [MED]
- [ ] P2 Email HTML not escaped — XSS (email-templates.ts:198) [LOW]
- [ ] P3 Booking total excludes tax on confirm screen (book/[slug]/client.tsx:1250) [LOW]
</content>
</invoke>
