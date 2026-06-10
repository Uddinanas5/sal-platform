# Phase 1 — Tenant Isolation (Evidence)

Date: 2026-06-10. Branch: `harden/production-readiness`.

## What was done

### 1A — Cross-tenant / IDOR test suite (COMPLETE, launch blocker)
Added 68 regression tests under `tests/cross-tenant/` — one file per tenant-owned
v1 `[id]` resource — each proving tenant A cannot GET/PATCH/DELETE tenant B's row
by id. Each test asserts, against the REAL route:
- a foreign-owned id returns **404 NOT_FOUND** (or **403** when an access gate like
  `canAccessAppointment` denies first),
- every `prisma.<model>.findUnique/update/delete` carries `businessId: ctx.businessId`
  in its `where`, so a foreign row is **structurally unreachable**,
- **401** when unauthenticated, **403** when the caller's role is `staff` and the
  method is admin-gated.

| Resource (route) | Methods | Tests | Result |
| --- | --- | --- | --- |
| appointments/[id] | GET/PATCH/DELETE | 11 | scoped ✅ (canAccessAppointment gate + businessId where) |
| clients/[id] | PATCH/DELETE | 6 | scoped ✅ (P2025→404) |
| products/[id] | GET/DELETE | 6 | scoped ✅ |
| services/[id] | GET/PATCH/DELETE | 9 | scoped ✅ |
| resources/[id] | PATCH/DELETE | 9 | scoped ✅ |
| forms/[id] | PATCH/DELETE | 6 | scoped ✅ |
| memberships/plans/[id] | PATCH/DELETE | 6 | scoped ✅ |
| marketing/campaigns/[id] | PATCH/DELETE | 6 | scoped ✅ |
| reviews/[id]/respond | POST | 4 | scoped ✅ |
| team/invitations/[id] | DELETE | 5 | scoped ✅ (ownership check before write) |

**Verdict: NO IDOR vulnerability found** — every tested route is correctly tenant-scoped.
This complements the pre-existing cross-tenant tests (services POST, staff, gift-cards,
memberships, clients-notes, reviews, waitlist, visit-notes, appointments self-scope) and
the `assertOwnedRefs`/`scopedWhere` helpers.

### Role escalation
Covered alongside the IDOR suite (each gated method asserts 403-for-staff) plus the
existing `group-a-tenant-authz` admin-gate tests (issueGiftCard, updateStaffProfile,
account deletion owner-only) and `group-security-access-control`.

## Planned next / fast-follow (designed, not yet implemented)
- **1B — global fail-closed Prisma guard** (`src/lib/tenant-context.ts` +
  `src/lib/prisma-tenant.ts`): two-tier classification (DIRECT_BUSINESS_ID enforced,
  RELATION_SCOPED logged, GLOBAL passthrough), AsyncLocalStorage tenant context,
  ship in `log` mode → throw in dev/CI → flip prod after a bake. Mechanism is a
  launch item; the prod throw-flip is a fast-follow.
- **1C — Supabase RLS** as the second wall (fast-follow): the app's DB role bypasses
  RLS, so it requires a per-request `SET LOCAL app.business_id` GUC + policies, built
  and rehearsed on a cloned schema with a committed rollback + kill-switch. The
  BYPASSRLS removal is the one hard-to-reverse step (founder sign-off).

## What I could NOT verify
- A live 2-tenant browser session probing (only code-traced + mock-tested).
- The relation-scoped models (Staff, Commission, AppointmentService, …) are covered
  by the existing per-resource tests + `assertOwnedRefs`, but the global guard's teeth
  are only on the direct-businessId class — RLS is what closes the relation-scoped gap
  at the DB level (fast-follow).
- That the app's Supabase role actually has BYPASSRLS (assumed) — confirm before 1C.
