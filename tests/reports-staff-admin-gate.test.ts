import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { hasRole } from "@/lib/permissions"

// L-042 — the admin-only READ routes (/reports, /reports/payday, /staff list)
// expose shop revenue, per-barber commission, payroll and staff PII, but their
// ONLY role-LEVEL gate was the STAFF_BLOCKED_ROUTES middleware, which keys on the
// 7-day JWT role (set at login, never refreshed). A demoted admin's token still
// says "admin" for up to 7 days, and the shared layout only redirects on NULL
// membership — never enforces the admin LEVEL — so the data still rendered.
//
// The fix re-checks the LIVE DB role (resolveBusinessRole) inside each page and
// redirects anyone who isn't currently admin+. Two locks below:
//   1. behavioural — hasRole() is the exact gate predicate (staff/null → denied,
//      admin/owner → allowed);
//   2. source-guard — each admin-only page actually wires that live-role gate
//      (these are RSCs and can't be behaviourally driven in this harness).

const ROOT = process.cwd()

describe("hasRole — the admin-only gate predicate (L-042)", () => {
  it("DENIES a staff role", () => expect(hasRole("staff", "admin")).toBe(false))
  it("DENIES a revoked/unknown null or undefined role", () => {
    expect(hasRole(null, "admin")).toBe(false)
    expect(hasRole(undefined, "admin")).toBe(false)
  })
  it("DENIES an unrecognized role string", () => expect(hasRole("guest", "admin")).toBe(false))
  it("ALLOWS an admin", () => expect(hasRole("admin", "admin")).toBe(true))
  it("ALLOWS an owner (above admin in the hierarchy)", () => expect(hasRole("owner", "admin")).toBe(true))
})

const ADMIN_ONLY_PAGES = [
  "src/app/(dashboard)/reports/page.tsx",
  "src/app/(dashboard)/reports/payday/page.tsx",
  "src/app/(dashboard)/staff/page.tsx",
]

// `if (!hasRole(<liveRole>, "admin")) redirect("/dashboard")` in any spacing.
const LIVE_ADMIN_GATE = /!hasRole\([^,]+,\s*"admin"\)\)\s*redirect\("\/dashboard"\)/

describe("admin-only read pages enforce the LIVE admin role, not the stale-JWT middleware (L-042)", () => {
  for (const rel of ADMIN_ONLY_PAGES) {
    it(`${rel} resolves the live role and redirects non-admins`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf8")
      expect(src, `${rel} should resolve the live role via resolveBusinessRole`).toContain("resolveBusinessRole")
      expect(
        LIVE_ADMIN_GATE.test(src),
        `${rel} should redirect to /dashboard when the LIVE role is not admin+`,
      ).toBe(true)
    })
  }
})
