import { TZDate } from "@date-fns/tz"

/**
 * Timezone-aware composition of an appointment's civil date with a `@db.Time`
 * wall-clock value.
 *
 * Background: `BusinessHours.openTime/closeTime` and `StaffSchedule.startTime/
 * endTime` (plus break and time-off windows) are Prisma `@db.Time` columns. The
 * Prisma query engine deserializes a Postgres `time` value into a JS Date pinned
 * to 1970-01-01 with the wall-clock expressed in **UTC** (the adapter's write
 * path serializes with getUTCHours — see @prisma/adapter-pg formatTime — so the
 * read side must mirror it with getUTCHours/getUTCMinutes, NOT getHours). Reading
 * with getHours() returns the right wall-clock hour only when the server TZ
 * happens to equal UTC, which silently breaks on any non-UTC host.
 *
 * These helpers anchor the @db.Time wall-clock to the SALON's IANA timezone
 * (Business.timezone), so a salon that opens "09:00" resolves to the correct UTC
 * instant (e.g. 13:00Z in EDT, 14:00Z in EST) on any host — server-local or UTC.
 */

/** Read a `@db.Time` Date's wall-clock components (stored in UTC by Prisma). */
export function timeParts(time: Date): { hours: number; minutes: number; seconds: number } {
  return {
    hours: time.getUTCHours(),
    minutes: time.getUTCMinutes(),
    seconds: time.getUTCSeconds(),
  }
}

/**
 * Combine the civil date Y/M/D with a `@db.Time` wall-clock (h:m:s) in the given
 * IANA timezone and return the correct UTC instant. `civilDate` only contributes
 * its calendar day; the time-of-day comes entirely from `time` interpreted in
 * `timezone`. When `timezone` is falsy, falls back to UTC (matches the schema
 * default and keeps behaviour deterministic on any host).
 */
export function combineDateWithTimeZoned(civilDate: Date, time: Date, timezone: string): Date {
  const { hours, minutes, seconds } = timeParts(time)
  // civilDate is constructed at local midnight of the requested day (parseYmd /
  // a stored startTime), so its local getters yield the intended calendar day.
  const year = civilDate.getFullYear()
  const month = civilDate.getMonth()
  const day = civilDate.getDate()
  const zoned = new TZDate(year, month, day, hours, minutes, seconds, 0, timezone || "UTC")
  // Return a plain Date (UTC instant) so all downstream comparisons are on the
  // absolute timeline, independent of the host or the TZDate wrapper.
  return new Date(zoned.getTime())
}

/**
 * Build a `@db.Time` write value from an "HH:MM" (or "HH:MM:SS") wall-clock so
 * the @prisma/adapter-pg formatTime (getUTCHours) serializes the intended
 * wall-clock regardless of host TZ. Using a local `new Date(1970,0,1,h,m)` would
 * store a shifted time on a non-UTC host.
 */
export function timeStringToUtcDate(timeStr: string): Date {
  const [h, m, s] = timeStr.split(":").map(Number)
  return new Date(Date.UTC(1970, 0, 1, h || 0, m || 0, s || 0, 0))
}

/**
 * Format an appointment instant for a recipient in the SALON's timezone.
 *
 * Customer-facing emails (confirmation / reschedule / reminder) must print the
 * appointment time in the salon's clock, not the SERVER's. On a UTC host a
 * 9:00 America/New_York appointment would otherwise render as "1:00 PM". This
 * centralizes the `Intl.DateTimeFormat(..., { timeZone })` so every email call
 * site renders identically. Falls back to UTC when `timezone` is falsy (schema
 * default), matching the rest of this module.
 */
export function formatInZone(
  instant: Date,
  timezone: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...opts,
    timeZone: timezone || "UTC",
  }).format(instant)
}

/** Salon-local calendar date (YYYY-MM-DD) for an instant in the given zone. */
export function localDateString(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}
