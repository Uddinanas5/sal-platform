# Public Projections

Anything an unauthenticated client can reach — public booking page, manage-link, embedded widget, public-facing API/RSS — must use an explicit projection helper. Never pass a raw Prisma row to a `"use client"` component or serialize it into a public response.

## The rule

For each public surface that needs entity data:

1. Add a helper in `src/lib/queries/` named `get<Surface><Entity>(...)` (e.g. `getPublicBookingStaff`).
2. Define a typed return interface in the same file. The interface is the contract for what crosses the trust boundary.
3. Only include fields the client UI demonstrably renders. If you cannot point to the JSX/handler that consumes a field, it does not belong on the wire.
4. The page/route imports the helper and the type. It does not call `prisma.<entity>.findMany` directly.
5. Do not widen the type later "just in case." If a new feature needs a new field, add it deliberately and audit it.

## Why this is load-bearing

RSC payloads, JSON responses, and prop streams are all scrapeable. A field that "the UI doesn't show" is still in the document source — `View Source`, devtools network tab, or a one-line curl will surface it. Multi-tenant SaaS makes this worse: a competitor can iterate slugs and exfil staff PII / pay structure / schedules at zero cost.

The bug that motivated this rule (GAP-025): the public booking page was passing `commissionRate`, `staffSchedules[]`, `email`, and `phone` for every staff member to a client component that only rendered `name` and `color`. The `as never[]` cast at the prop boundary was the typesystem trying to warn us and being silenced.

## Existing helpers

- `getPublicBookingStaff(businessId)` → `PublicBookingStaff[]` — staff list for `/book/[slug]`

When you add the next one, list it here.
