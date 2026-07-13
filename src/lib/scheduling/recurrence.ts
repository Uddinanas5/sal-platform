import { TZDate } from "@date-fns/tz"
import { addWeeks, addMonths } from "date-fns"

export type RecurrenceRule = "weekly" | "biweekly" | "monthly"

/**
 * Generate recurring occurrence START instants for a standing appointment,
 * advancing the cursor in the SALON's IANA timezone so every occurrence keeps the
 * same salon-local wall-clock time across a DST boundary.
 *
 * Why this matters: plain date-fns `addWeeks`/`addMonths` on a `new Date(...)`
 * instant use the HOST's local setters. On a UTC host (Vercel) that holds the UTC
 * time-of-day constant, so after a spring-forward/fall-back the salon-local time
 * drifts by the DST offset — a 9:00 AM weekly cut silently becomes 10:00 AM (or
 * gets pushed past close and rejected). A fixed millisecond step (7*86400000) has
 * the same drift, and a flat "30 days" for monthly walks off the calendar date
 * entirely. Wrapping the cursor in a `TZDate` makes date-fns operate in
 * `timezone`, preserving the wall-clock; the returned values are plain UTC
 * `Date`s ready to store.
 *
 * The list INCLUDES `start`, adds occurrences up to and including `endDate`, and
 * is capped at `max` total (safety limit).
 */
export function generateRecurrenceDates(opts: {
  start: Date
  rule: RecurrenceRule
  endDate: Date
  timezone: string
  max?: number
}): Date[] {
  const { start, rule, endDate, timezone, max = 52 } = opts
  const dates: Date[] = [new Date(start.getTime())]
  // Anchor the cursor to the salon zone; date-fns preserves the TZDate type, so
  // subsequent add* operations stay in that zone.
  let cursor: TZDate = new TZDate(start.getTime(), timezone)
  while (dates.length < max) {
    cursor = rule === "monthly" ? addMonths(cursor, 1) : addWeeks(cursor, rule === "biweekly" ? 2 : 1)
    const instant = new Date(cursor.getTime())
    if (instant > endDate) break
    dates.push(instant)
  }
  return dates
}
