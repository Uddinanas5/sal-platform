import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// L-036 — the dashboard READ pages gated data visibility on the STALE 7-day JWT
// role (session.user.role) instead of the live DB role. A demoted admin therefore
// kept admin-level visibility (full calendar, shop revenue, every barber's
// performance, "delete any note") until their cookie expired — up to 7 days.
//
// The fix routes every read-side role decision through resolveBusinessRole()
// (the codebase's single source of truth for the CURRENT owner/admin/staff role),
// exactly as the server actions + REST/MCP layers already do.
//
// These pages are React Server Components — they can't be behaviourally unit-tested
// in this harness. The behaviour that matters ("resolveBusinessRole returns the
// FRESH DB role, not the JWT claim") is already locked by
// tests/membership-revocation.test.ts. This is the companion *fitness function*:
// it fails if any of these pages regresses to reading the role off the JWT again.

const ROOT = process.cwd()

// Files that make a role-based visibility/authorization decision on a read page.
const GUARDED_FILES = [
  "src/app/(dashboard)/layout.tsx",
  "src/app/(dashboard)/calendar/page.tsx",
  "src/app/(dashboard)/dashboard/page.tsx",
  "src/app/(dashboard)/staff/[id]/page.tsx",
  "src/app/(dashboard)/clients/[id]/page.tsx",
  "src/app/(dashboard)/settings/page.tsx",
]

// A stale-JWT role read is a `.role` access off the `session` object, in any of its
// cast forms: `session.user.role`, `session?.user?.role`, `(session.user as any).role`.
// Anchored to `session` on the same line so a legit DB read like `s.user.role`
// (a roster member's role) or an identity read like `session.user.id` is NOT flagged.
const STALE_SESSION_ROLE = /session.*\.role\b/

describe("dashboard read pages resolve the role from the LIVE DB, not the JWT (L-036)", () => {
  for (const rel of GUARDED_FILES) {
    it(`${rel} routes its role decision through resolveBusinessRole and never reads the JWT role`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf8")

      // Must derive the role from the live-membership resolver.
      expect(src, `${rel} should call resolveBusinessRole`).toContain("resolveBusinessRole")

      // Must NOT read the role off the session/JWT for its gate.
      const offending = src.split("\n").filter((line) => STALE_SESSION_ROLE.test(line))
      expect(
        offending,
        `${rel} still reads the STALE JWT role — gate on resolveBusinessRole instead:\n${offending.join("\n")}`,
      ).toEqual([])
    })
  }
})
