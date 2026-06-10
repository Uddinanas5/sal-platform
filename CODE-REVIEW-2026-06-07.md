# SAL Platform — Security & Correctness Review
_Generated 2026-06-07 via multi-agent ultracode review (66 agents, 9 dimensions, every finding adversarially verified). 56 raw findings → 37 confirmed._

## Executive Summary

The SAL platform has a fundamentally sound multi-tenant core: the primary V1 REST endpoints (bookings, services, products, staff) correctly scope foreign-key references by `businessId`, the OAuth flow enforces mandatory PKCE, and the checkout/payment transaction logic is largely careful. However, the tenancy boundary is enforced **inconsistently** rather than systematically — a recurring class of bug appears where newly-added endpoints (memberships, waitlist, forms) and the entire MCP tool layer accept caller-supplied `clientId`/`serviceId`/`staffId`/`categoryId` and write them to the database without verifying ownership. This is the single most dangerous pattern in the codebase and it spans the REST API, server actions, and MCP tools simultaneously. Separately, there is a confirmed **revenue leak** (no application fee is charged on any Stripe Connect payment) and a cluster of **dishonest UI affordances** that show fake success toasts for Edit/Send Message/Cancel/Export actions that do nothing.

**Top 3 things to fix first:**
1. **Membership cross-tenant client assignment** (critical) — an authenticated tenant can attach a membership to another salon's client; this directly breaks the cardinal rule and touches billing relationships.
2. **$0 application fee on all Connect payments** (high, revenue) — the platform is currently earning zero transaction commission; the plumbing exists but is never invoked.
3. **The fake "Cancel" appointment button** (high, honesty) — it tells the user the appointment was cancelled while leaving it active in the DB, which will cause real no-shows and scheduling chaos.

---

## CRITICAL

### 1. [CRITICAL] Membership creation allows cross-tenant client assignment
**File:** `src/app/api/v1/memberships/route.ts:44-52`
The POST handler validates that `planId` belongs to `ctx.businessId` but never validates `clientId`, so a user in Salon A can create a membership for any client UUID in Salon B. This corrupts billing relationships and lets an attacker hijack or block legitimate membership records — a direct violation of the multi-tenant contract.
**Fix:** Before creating, verify ownership:
```ts
const client = await prisma.client.findFirst({
  where: { id: parsed.data.clientId, businessId: ctx.businessId },
});
if (!client) return ERRORS.NOT_FOUND("Client");
```
The PATCH endpoint at `[id]/route.ts:16` already demonstrates the correct `plan: { businessId: ctx.businessId }` pattern.

---

## HIGH

### 2. [HIGH] Form submission accepts unvalidated client/appointment IDs (3 code paths)
**Files:** `src/app/api/v1/forms/[id]/submit/route.ts:26-34`, `src/lib/actions/forms.ts:134-143`, `src/lib/mcp/tools/forms.ts:88-99`
All three implementations correctly scope the form *template* to the business but write `clientId` (and optional `appointmentId`) into `FormSubmission` without ownership checks. `FormSubmission` has no FK constraints on these columns (schema.prisma:1622-1639), so an attacker can bind form data — including potentially sensitive intake responses — to another salon's clients.
**Fix:** In all three paths, validate before creating:
```ts
const client = await prisma.client.findFirst({
  where: { id: parsed.data.clientId, businessId: ctx.businessId },
});
if (!client) return ERRORS.NOT_FOUND("Client");
if (parsed.data.appointmentId) {
  const appt = await prisma.appointment.findFirst({
    where: { id: parsed.data.appointmentId, businessId: ctx.businessId },
  });
  if (!appt) return ERRORS.NOT_FOUND("Appointment");
}
```

### 3. [HIGH] Waitlist entry creation accepts cross-tenant references (REST + MCP)
**Files:** `src/app/api/v1/waitlist/route.ts:40-56`, `src/lib/mcp/tools/waitlist.ts:33-48`
Neither path validates `clientId`, `serviceId`, or `staffId` against the caller's business, and `waitlist_entries` has only a `business_id` FK (no FK on the other three columns). An authenticated user can pollute their waitlist with references to other tenants' clients/services/staff, creating dangling references that can disrupt calendar/booking logic.
**Fix:** Validate each provided ID:
```ts
if (clientId && !await prisma.client.findFirst({ where: { id: clientId, businessId: ctx.businessId } }))
  return ERRORS.NOT_FOUND("Client");
if (serviceId && !await prisma.service.findFirst({ where: { id: serviceId, businessId: ctx.businessId } }))
  return ERRORS.NOT_FOUND("Service");
if (staffId && !await prisma.staff.findFirst({ where: { id: staffId, primaryLocation: { businessId: ctx.businessId } } }))
  return ERRORS.NOT_FOUND("Staff");
```

### 4. [HIGH] OAuth register endpoint accepts any redirect_uri and is unauthenticated
**File:** `src/app/api/oauth/register/route.ts:5-56` (validation at 19-23)
The dynamic client registration endpoint is public (`/api/oauth/.*` is whitelisted in `middleware.ts:40`) and accepts arbitrary `redirect_uris` with only a non-empty-string check — no URL format, no `https://` enforcement, no ownership. An attacker can register `redirect_uris: ["javascript:alert(1)"]` (accepted by `new URL()` in `oauth.ts:61-62`) for XSS, or `http://attacker.com` to phish users and steal authorization codes.
**Fix:** (1) Require authentication (`const ctx = await withV1Auth(req); if (!ctx) return ERRORS.UNAUTHORIZED();`); (2) validate each `redirect_uri` is a well-formed `https://` URL (reject `javascript:`, `data:`, and non-https in production); (3) bind registered clients to the authenticating business.

### 5. [HIGH] No application fee charged on any Stripe Connect payment (revenue leak)
**File:** `src/app/api/stripe/create-payment-intent/route.ts:102-112`
`createPaymentIntent` accepts an optional `applicationFeeAmount` (stripe.ts:29, applied at 54-56), but the only call site never computes or passes it. The result: SAL collects **$0 in transaction commission** on all online card payments routed via `transfer_data` to salons' Connect accounts.
**Fix:** Compute the fee server-side from a configured rate (store on `Business.settings` or global config) and pass it:
```ts
const applicationFeeAmount = Math.round((amount * commissionRate) / 100);
```
Never accept the commission value from the client.

### 6. [HIGH] charge.refunded webhook uses unscoped processorId lookup
**File:** `src/app/api/stripe/webhook/route.ts:303-305`
The refund handler looks up `Payment` by `processorId` alone with no `businessId` scope; `processorId` is nullable with no unique constraint (schema.prisma:900-944). The same unscoped pattern appears in `payment_intent.succeeded` (208-209) and `payment_intent.payment_failed` (279-280). While Stripe PI IDs are globally unique and webhooks are HMAC-signed (limiting practical exploitation), this relies entirely on Stripe's external uniqueness instead of enforcing tenancy in the app layer.
**Fix:** Extract `businessId` from `paymentIntent.metadata.businessId` (already set at create-payment-intent:109) and include it in every webhook `Payment` lookup.

### 7. [HIGH] POST /api/bookings omits timezone in availability check
**File:** `src/app/api/bookings/route.ts:263-272`
`isSlotAvailable()` is called without the `timezone` parameter (available at line 223), so it defaults to UTC while `assertSlotAllowed` inside the transaction (line 334) correctly uses the salon timezone. For any non-UTC salon this mismatch silently rejects slots that appeared available or accepts ones that violate working hours, producing spurious 409s.
**Fix:** Pass the timezone: `isSlotAvailable({ staffId, serviceId, startTime, locationId, timezone })`. The public booking action (`public-booking.ts:181-186`) shows the correct pattern.

### 8. [HIGH] POST /api/bookings does not re-check canAcceptBookings inside transaction
**File:** `src/app/api/bookings/route.ts:240-349`
The pre-transaction availability check honors `canAcceptBookings`, but inside the transaction (lines 330-349) only working hours and conflicts are re-validated — not `canAcceptBookings`. An operator who toggles a staff member off can still receive appointments via this path due to the race window. `reschedulePublicBooking` (public-booking.ts:739-745) already does this check correctly.
**Fix:** Inside the transaction, add:
```ts
const staff = await tx.staff.findUnique({ where: { id: svc.staffId }, select: { canAcceptBookings: true } });
if (!staff?.canAcceptBookings) throw new Error("STAFF_NOT_ACCEPTING");
```

### 9. [HIGH] Recurring series DELETE accepts unvalidated cancelFrom timestamp (DoS)
**File:** `src/app/api/v1/appointments/recurring/[seriesId]/route.ts:13,25`
`cancelFrom` is taken from the query string and passed straight into `new Date(cancelFrom)`. A malformed value yields an `Invalid Date`, and when Prisma serializes it via `.toISOString()` it throws an uncaught `RangeError`, crashing the request. Same pattern in `mcp/tools/appointments.ts:493` and `actions/recurring.ts:419`.
**Fix:** Validate with `z.string().datetime()` (or `parseYmd()` as in the appointments GET route) and return 400 on failure.

### 10. [HIGH] importClients performs multi-row writes without a transaction
**File:** `src/lib/actions/clients.ts:227-326`
The CSV import loops over rows doing individual `create`/`update` calls with per-row error catching. If row 51 fails, rows 1–50 are already committed with no atomic retry — re-importing duplicates the first 50. (Tenancy scoping by `businessId` is correct here; this is a data-integrity issue.)
**Fix:** Wrap the loop in `prisma.$transaction()`, or do a pre-validation pass that surfaces all conflicts before any write.

### 11. [HIGH] FK repair migration reveals production schema lacked payment_id FK
**File:** `prisma/migrations/20260606160000_appointment_product_payment_fk_repair/migration.sql:1-26`
The earlier migration `20260606140000` guarded its FK creation with `WHERE conname = 'appointment_products_payment_id_fkey'` (no schema scope). Because `pg_constraint` is database-wide, when `dev`/`agents` schemas ran first the guard found the name and **skipped creation in `public`** — production ran without the FK, allowing payments to be deleted while still referenced by `appointment_products`. This repair migration fixes it via `connamespace`.
**Fix:** Audit all conditional migrations touching `pg_constraint`/`pg_index` to ensure they filter by `connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())`, and add a pre-deploy check comparing constraint/index presence across the three schemas.

### 12. [HIGH] MCP services/staff tools allow cross-tenant ID assignment
**Files:** `src/lib/mcp/tools/services.ts:49-86` (categoryId), `src/lib/mcp/tools/staff.ts:61-86` (serviceIds)
The MCP `create-service`/`update-service` tools accept `categoryId` and `create-staff` accepts `serviceIds`, none validated against `ctx.businessId`. The equivalent REST endpoints (`v1/services/route.ts:41-45`, `v1/staff/route.ts:50-56`) implement the correct guards, which the MCP layer omits — the route header even admits tools "skip ownership scoping on some foreign ids." (Severity is partially mitigated by MCP being beta-gated off via `MCP_ENABLED`.)
**Fix:** Mirror the REST guards — `findFirst({ id, businessId })` for category, and `service.count({ id: { in: serviceIds }, businessId })` matching `serviceIds.length` before creating `StaffService` rows.

### 13. [HIGH] Clients table "Edit" and "Send Message" dropdown items are fake (toast-only)
**File:** `src/app/(dashboard)/clients/client.tsx:435` (Edit), `:439` (Send Message)
In the table view, "Edit" only calls `toast.info(...)` and "Send Message" calls `toast.success("Message sent to ...")` — no dialog opens and no email client launches. The card view does these correctly (Edit navigates at 138-141, Send Message opens `mailto:` at 142-151). Users get false success feedback and may believe a client was contacted when nothing happened.
**Fix:** Reuse the card-view logic — navigate to `/clients/${client.id}` (or open `EditClientDialog`) for Edit, and `window.open('mailto:' + client.email)` for Send Message, with an error if no email exists.

### 14. [HIGH] Inventory bulk "Export" is fake (toast-only)
**File:** `src/app/(dashboard)/inventory/client.tsx:270`
The bulk-action "Export" only calls `toast.success("Exported N products to CSV")` without invoking `exportToCsv()`. The single export button above (175-198) and the bulk delete action (276) both work correctly, proving the pattern is known.
**Fix:** Call `exportToCsv(rows...)` before the toast, matching lines 179-193.

### 15. [HIGH] Appointment card "Cancel" shows fake success without cancelling
**File:** `src/components/dashboard/appointment-card.tsx:155`
The "Cancel" dropdown item calls only `toast.success(...)` claiming the appointment was cancelled — it never calls `updateAppointmentStatus()` (imported at line 18) nor updates local state. The appointment stays active in the DB. This is the most damaging honesty defect: it will directly cause believed-cancelled appointments to remain on the books.
**Fix:** Call `updateAppointmentStatus()` (or a dedicated cancel action), check the result, update state, and only then toast — or remove the item and route users to the working cancel flow in `AppointmentDetailSheet`.

---

## MEDIUM

### 16. [MEDIUM] Group participant DELETE skips client ownership check
**File:** `src/app/api/v1/appointments/groups/[id]/participants/[clientId]/route.ts:21-23`
The handler validates the appointment belongs to `ctx.businessId` (line 16) but not the `clientId` being removed. Exploitability is low (creation endpoints prevent cross-business `GroupParticipant` rows from existing), but it violates defense-in-depth.
**Fix:** Verify `client.findFirst({ id: clientId, businessId: ctx.businessId })` before the delete.

### 17. [MEDIUM] MCP products tool allows cross-tenant categoryId assignment
**File:** `src/lib/mcp/tools/products.ts:60-91`
`create-product` accepts `categoryId` without checking it belongs to the business; the REST endpoint (`v1/products/route.ts:64-68`) does. Allows orphaning products under another salon's category, breaking inventory reports.
**Fix:** `if (categoryId) { const c = await prisma.productCategory.findFirst({ where: { id: categoryId, businessId: ctx.businessId } }); if (!c) return err("Product category not found"); }`

### 18. [MEDIUM] OAuth token endpoint does not require redirect_uri on code exchange
**File:** `src/app/api/oauth/token/route.ts:55`
`if (redirectUri && authCode.redirectUri !== redirectUri)` only validates `redirect_uri` when supplied, but RFC 6749 §4.1.3 requires it in the token request if it was in the auth request. Mitigated by mandatory PKCE (line 60), hence medium not critical.
**Fix:** `if (!redirectUri || authCode.redirectUri !== redirectUri) return ERRORS...;`

### 19. [MEDIUM] OAuth access tokens hardcoded to "admin" role, scope ignored
**File:** `src/lib/api/auth.ts:37`
All OAuth tokens get `role: "admin"` regardless of the stored `scope` (schema.prisma:1741, populated at token/route.ts:82). The role hierarchy still blocks owner-only operations (api-keys), so impact is bounded, but `scope` is entirely unenforced — any future read-only scope would be silently ignored.
**Fix:** Map `oauthToken.scope` to a role at validation time, or store and read `oauthToken.role`; default OAuth tokens to a tier no higher than `staff`.

### 20. [MEDIUM] resetPassword action has no rate limiting
**File:** `src/lib/actions/password-reset.ts:37-39`
`requestPasswordReset` is rate-limited (3/hour/email), but `resetPassword` (lines 87-143) is not. An attacker holding a valid token can attempt unlimited password changes within the 1-hour window.
**Fix:** Add `rateLimit(`reset-password:${token}`, 5, 15*60*1000)` at the top of `resetPassword`.

### 21. [MEDIUM] OAuth register endpoint unauthenticated (phishing vector)
**File:** `src/app/api/oauth/register/route.ts:5-56`
Anyone can register OAuth clients without credentials (this is the auth-gap half of finding #4; not a cross-tenant data bypass since tokens carry the authorizing user's `businessId`). Enables mass registration of malicious clients for phishing.
**Fix:** Gate behind `withV1Auth` as in #4.

### 22. [MEDIUM] checkout customItems array has no max length
**File:** `src/lib/actions/checkout.ts:47-54` (also `api/v1/checkout/route.ts:39-44`, `mcp/tools/checkout.ts:48-53`)
`z.array(...).default([])` with no `.max()`. A request with thousands of custom items forces per-item processing and a large `Payment.notes` write, risking memory pressure / 20s transaction-timeout cascades.
**Fix:** `.max(100)` on the array in all three schemas.

### 23. [MEDIUM] updateBusinessDetails writes Business then Location without a transaction
**File:** `src/lib/actions/onboarding.ts:75-97`
`business.update()` (75-82) and `location.update()` (87-97) are separate writes; a failure between them leaves business name/timezone committed while location is not, producing mismatched onboarding state.
**Fix:** Wrap both in `prisma.$transaction()`.

### 24. [MEDIUM] Waitlist preferred times stored as UTC wall-clock without timezone
**File:** `src/lib/actions/public-booking.ts:455-460`
`preferredTimeStart/End` are passed to `timeStringToUtcDate`, which interprets `"14:30"` as 14:30 **UTC** rather than salon-local. The business timezone is fetched (line 370) but unused, so a NY client's "Morning (9am–12pm)" is stored as 09:00 UTC. Impact is limited because these are advisory display-only values, never used for actual matching.
**Fix:** Convert the time string using the business timezone, or explicitly label these as UTC wall-clock in the UI.

### 25. [MEDIUM] Appointment card "View Details", "Edit", "Reschedule" are inert (toast-only)
**File:** `src/components/dashboard/appointment-card.tsx:140` (View Details), `:144` (Edit), `:148` (Reschedule)
All three dropdown items only fire a toast with no navigation, dialog, or action — despite a fully functional `AppointmentDetailSheet` existing. (Medium vs. the high "Cancel" item because they don't falsely claim a destructive action succeeded.)
**Fix:** Wire each to `AppointmentDetailSheet`, or remove the inert items. Note no `updateAppointment` action exists yet, so "Edit" needs either a new action or removal.

---

## LOW

### 26. [LOW] Review token secret falls back to a hardcoded dev value
**File:** `src/lib/reviews/review-token.ts:8-14`
If `REVIEW_TOKEN_SECRET`, `NEXTAUTH_SECRET`, and `AUTH_SECRET` are all unset, the code uses the committed string `'sal-dev-review-token-secret'`. In practice `NEXTAUTH_SECRET` is enforced as required at startup (`lib/env.ts`), so the fallback is effectively unreachable in normal deploys.
**Fix:** Remove the hardcoded fallback and `throw` if no secret is configured.

### 27. [LOW] Checkout tax calculation accumulates floating-point before a single round
**File:** `src/lib/checkout/record-checkout.ts:325-332`
Per-line tax shares are computed in floating point and summed before one final round, which can drift by a cent across many line items with mixed tax rates. The intermediate tax is never persisted (only the final `total`), so there is no data corruption — the only real risk is a frontend/backend display mismatch.
**Fix:** Do all intermediate math in integer cents, dividing by 100 only at the end.

### 28. [LOW] Recurring series creation uses only a soft cap on occurrences
**File:** `src/app/api/v1/appointments/recurring/route.ts:72-81`
The loop breaks at `dates.length > 52` with no validation that `recurrenceEndDate` is within a reasonable bound. A 52-occurrence series completes well within the 20s transaction timeout and is tenant-scoped, so practical DoS risk is low.
**Fix:** Validate `recurrenceEndDate` is within ~12 months and consider lowering the cap to 26.

### 29. [LOW] Reviews GET accepts unvalidated status/rating filters that are silently ignored
**File:** `src/app/api/v1/reviews/route.ts:14-19`
`status` and `rating` are passed into the Prisma `where`, but the `Review` model has neither field (it has `overallRating` etc.), so Prisma silently ignores them — the filters have **zero effect** and return all reviews regardless. Incomplete-implementation bug, not an exploit.
**Fix:** Either implement the filters against the real columns (`overallRating`) with proper validation, or remove the dead parameters.

---

## Cross-cutting recommendation

The cross-tenant ID-injection findings (#1, #2, #3, #12, #16, #17) are all the same root cause: write paths trust caller-supplied foreign keys. Rather than patching each call site ad hoc, add a small shared helper (e.g., `assertOwned(prisma, "client", id, ctx.businessId)`) and apply it uniformly across REST routes, server actions, and MCP tools — then add cross-tenant probing tests (already flagged as a launch requirement in `HANDOFF.md:58-59`) so regressions are caught automatically. The MCP tool layer in particular needs a hardening pass before `MCP_ENABLED` is ever turned on in production.
