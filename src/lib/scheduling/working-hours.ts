import { prisma } from "@/lib/prisma"
import { combineDateWithTimeZoned } from "@/lib/scheduling/zoned-time"

// Internal error sentinels thrown by assertSlotAllowed. Callers catch and
// translate to user-facing copy (toast / API error body). Strings are stable.
export const ERR_OUTSIDE_WORKING_HOURS = "OUTSIDE_WORKING_HOURS"
export const ERR_ON_APPROVED_TIME_OFF = "ON_APPROVED_TIME_OFF"

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Salon-local civil day (YYYY-MM-DD components) for an absolute instant. The
// weekday lookup and the @db.Time wall-clock interpretation must both be done
// in the salon's timezone, not the server's, or a non-UTC host shifts the
// working-hours window by its UTC offset.
function civilPartsInZone(instant: Date, timezone: string): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  }
}

// Asserts that [start, end) falls inside the staff member's working hours for
// that weekday at that location, and does not overlap an approved time-off
// window. Throws ERR_OUTSIDE_WORKING_HOURS or ERR_ON_APPROVED_TIME_OFF on
// violation. Inclusive on boundaries: a service ending exactly at workEnd is
// fine. Called inside a transaction so it shares any locked staff schedule.
//
// `timezone` is the salon's IANA zone (Business.timezone). It anchors the
// weekday lookup and every @db.Time wall-clock (schedule/break/time-off) to the
// salon's clock, so the write guard agrees with the availability read path on
// any host. Defaults to UTC (schema default) when a caller has not yet been
// threaded — UTC matches how @db.Time is stored, so a UTC host is correct
// either way; non-UTC hosts MUST pass the real zone.
export async function assertSlotAllowed(
  tx: TxClient,
  staffId: string,
  locationId: string,
  start: Date,
  end: Date,
  timezone: string = "UTC",
): Promise<void> {
  const civil = civilPartsInZone(start, timezone)
  const dayOfWeek = civil.weekday
  // A local-midnight Date for the salon-local civil day, used to anchor @db.Time
  // wall-clock values via combineDateWithTimeZoned (it reads local getters).
  const civilDate = new Date(civil.year, civil.month - 1, civil.day)
  // Every comparison below is against @db.Date columns (schedule effective dates,
  // approved time-off start/end), which Postgres stores at UTC midnight. Build a
  // UTC-midnight day so a booking on the LAST day of an approved day-off isn't
  // let through by an off-by-one on non-UTC hosts.
  const startOfDay = new Date(Date.UTC(civil.year, civil.month - 1, civil.day))

  const [schedule, timeOff] = await Promise.all([
    tx.staffSchedule.findFirst({
      where: {
        staffId,
        locationId,
        dayOfWeek,
        isWorking: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: startOfDay } }],
        AND: [
          {
            OR: [
              { effectiveUntil: null },
              { effectiveUntil: { gte: startOfDay } },
            ],
          },
        ],
      },
      include: { breaks: true },
    }),
    tx.staffTimeOff.findFirst({
      where: {
        staffId,
        status: "approved",
        startDate: { lte: startOfDay },
        endDate: { gte: startOfDay },
      },
    }),
  ])

  if (!schedule) {
    throw new Error(ERR_OUTSIDE_WORKING_HOURS)
  }
  const workStart = combineDateWithTimeZoned(civilDate, schedule.startTime, timezone)
  const workEnd = combineDateWithTimeZoned(civilDate, schedule.endTime, timezone)
  if (start < workStart || end > workEnd) {
    throw new Error(ERR_OUTSIDE_WORKING_HOURS)
  }

  // Block staff breaks (e.g. lunch). The availability slot generator already
  // hides break times from the UI; the write path MUST enforce the same so a
  // crafted startTime can't land a client on top of a break.
  for (const brk of schedule.breaks ?? []) {
    const breakStart = combineDateWithTimeZoned(civilDate, brk.startTime, timezone)
    const breakEnd = combineDateWithTimeZoned(civilDate, brk.endTime, timezone)
    if (start < breakEnd && end > breakStart) {
      throw new Error(ERR_OUTSIDE_WORKING_HOURS)
    }
  }

  if (timeOff) {
    if (!timeOff.startTime || !timeOff.endTime) {
      // Full-day off
      throw new Error(ERR_ON_APPROVED_TIME_OFF)
    }
    const offStart = combineDateWithTimeZoned(civilDate, timeOff.startTime, timezone)
    const offEnd = combineDateWithTimeZoned(civilDate, timeOff.endTime, timezone)
    if (start < offEnd && end > offStart) {
      throw new Error(ERR_ON_APPROVED_TIME_OFF)
    }
  }
}
