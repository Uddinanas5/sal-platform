// SINGLE SOURCE OF TRUTH for the Terms of Service version.
//
// Bump TOS_VERSION whenever /terms materially changes. It is:
//   - persisted on User.tosVersion at registration (src/lib/actions/register.ts)
//     together with User.tosAcceptedAt, so we can PROVE which ToS revision an
//     account accepted and when (adversarial ToS review, finding #4);
//   - rendered as the "Last updated" date on /terms (src/app/terms/page.tsx),
//     so the page and the recorded version can never drift apart.
//
// Format: the ISO date (YYYY-MM-DD) of the revision. Treated as an opaque
// version string everywhere — never parsed as a Date (a `new Date("2026-06-11")`
// is UTC midnight and renders as the previous day in western timezones).
export const TOS_VERSION = "2026-06-11"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

/**
 * Render a TOS_VERSION ("2026-06-11") as display text ("June 11, 2026").
 * Pure string manipulation — deliberately timezone-independent (no Date
 * construction), so the /terms page shows the same date on any host TZ.
 */
export function formatTosVersion(version: string): string {
  const [year, month, day] = version.split("-").map(Number)
  const monthName = MONTH_NAMES[month - 1]
  if (!year || !monthName || !day) return version
  return `${monthName} ${day}, ${year}`
}
