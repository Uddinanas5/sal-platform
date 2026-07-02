# FIXES.md — Plain-English change log

*What changed and why, written so a non-coder can follow. Newest first. Each entry maps to a TASKS.md item.*

---

## P0-1 · Removed team members can no longer keep access

**Problem:** When you removed a staff member, they kept full access to your shop's data for up to 7 days — until their login "cookie" happened to expire. Removal only hid them from the team list; it didn't actually lock them out.

**Fix:** The app now checks, on every single request, whether the person is *still* an active member of your shop right now — not just whether their login once said so. The moment you remove someone (or a barber is deactivated), their next click is denied. As a bonus, role changes (e.g. demoting an admin to staff) also take effect immediately instead of lingering in their session. This reused the same live-membership check the API and AI-integration paths already had, so all three doors are now locked the same way.

**Proof:** 8 new automated tests cover a removed staffer being denied, a deactivated owner being denied, and the correct fresh role being used. Full suite green (558 tests).
