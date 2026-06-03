import { prisma } from "@/lib/prisma"

// Internal error sentinels thrown by assertSlotAllowed. Callers catch and
// translate to user-facing copy (toast / API error body). Strings are stable.
export const ERR_OUTSIDE_WORKING_HOURS = "OUTSIDE_WORKING_HOURS"
export const ERR_ON_APPROVED_TIME_OFF = "ON_APPROVED_TIME_OFF"

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Mirrors `combineDateWithTime` in src/lib/availability.ts — combines an
// appointment date with a `@db.Time` Prisma value (a Date pinned to 1970-01-01
// with the time-of-day in local time).
function combineDateWithTime(date: Date, time: Date): Date {
  const result = new Date(date)
  result.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0)
  return result
}

// Asserts that [start, end) falls inside the staff member's working hours for
// that weekday at that location, and does not overlap an approved time-off
// window. Throws ERR_OUTSIDE_WORKING_HOURS or ERR_ON_APPROVED_TIME_OFF on
// violation. Inclusive on boundaries: a service ending exactly at workEnd is
// fine. Called inside a transaction so it shares any locked staff schedule.
export async function assertSlotAllowed(
  tx: TxClient,
  staffId: string,
  locationId: string,
  start: Date,
  end: Date,
): Promise<void> {
  const dayOfWeek = start.getDay()
  const startOfDay = new Date(start)
  startOfDay.setHours(0, 0, 0, 0)

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
  const workStart = combineDateWithTime(start, schedule.startTime)
  const workEnd = combineDateWithTime(start, schedule.endTime)
  if (start < workStart || end > workEnd) {
    throw new Error(ERR_OUTSIDE_WORKING_HOURS)
  }

  // Block staff breaks (e.g. lunch). The availability slot generator already
  // hides break times from the UI; the write path MUST enforce the same so a
  // crafted startTime can't land a client on top of a break.
  for (const brk of schedule.breaks ?? []) {
    const breakStart = combineDateWithTime(start, brk.startTime)
    const breakEnd = combineDateWithTime(start, brk.endTime)
    if (start < breakEnd && end > breakStart) {
      throw new Error(ERR_OUTSIDE_WORKING_HOURS)
    }
  }

  if (timeOff) {
    if (!timeOff.startTime || !timeOff.endTime) {
      // Full-day off
      throw new Error(ERR_ON_APPROVED_TIME_OFF)
    }
    const offStart = combineDateWithTime(start, timeOff.startTime)
    const offEnd = combineDateWithTime(start, timeOff.endTime)
    if (start < offEnd && end > offStart) {
      throw new Error(ERR_ON_APPROVED_TIME_OFF)
    }
  }
}
