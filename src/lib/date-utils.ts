/**
 * Strict YYYY-MM-DD parser. Returns null for malformed input or impossible
 * calendar dates (e.g. 2027-02-30, 2026-13-01). Round-trips the parsed
 * components against the resulting Date to catch JS's silent month/day overflow
 * (`new Date('2026-06-31')` would otherwise roll forward to July 1).
 *
 * Returns a Date at local midnight of the requested day.
 */
export function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(year, month - 1, day)
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null
  }
  return d
}
