import { describe, it, expect } from "vitest"
import {
  assertSlotAllowed,
  ERR_OUTSIDE_WORKING_HOURS,
  ERR_ON_APPROVED_TIME_OFF,
} from "@/lib/scheduling/working-hours"

// Guards GAP-001: a reschedule/resize (or any booking write) must not land
// outside the staff member's working hours or during approved time off.
// assertSlotAllowed only reads tx.staffSchedule.findFirst + tx.staffTimeOff
// .findFirst, so we feed a fake tx — no DB needed.

// @db.Time values are Dates whose time-of-day is what matters. Prisma stores +
// reads them as UTC wall-clock (the adapter serializes with getUTCHours), so
// build them with Date.UTC — host-timezone independent. assertSlotAllowed below
// is called with the default "UTC" timezone, so the slot instants (`day`) are
// also UTC-anchored and the wall-clock comparisons line up on any host.
const t = (h: number, m = 0) => new Date(Date.UTC(2000, 0, 1, h, m, 0, 0))

function fakeTx(opts: {
  schedule?: { startTime: Date; endTime: Date } | null
  timeOff?: { startTime: Date | null; endTime: Date | null } | null
}) {
  return {
    staffSchedule: { findFirst: async () => opts.schedule ?? null },
    staffTimeOff: { findFirst: async () => opts.timeOff ?? null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// A Wednesday; appointment 10:00–10:45 by default. Built as a UTC instant so
// that under the default "UTC" timezone the salon-local wall clock equals h:m on
// any host (TZ=UTC or TZ=America/New_York).
const day = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 3, h, m, 0, 0))
const LOC = "loc_1"
const STAFF = "staff_1"
const open9to5 = { startTime: t(9), endTime: t(17) }

describe("assertSlotAllowed — working hours", () => {
  it("passes when the slot is fully inside working hours", async () => {
    const tx = fakeTx({ schedule: open9to5 })
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(10), day(10, 45))
    ).resolves.toBeUndefined()
  })

  it("passes when the slot ends exactly at close (inclusive boundary)", async () => {
    const tx = fakeTx({ schedule: open9to5 })
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(16), day(17))
    ).resolves.toBeUndefined()
  })

  it("passes when the slot starts exactly at open (inclusive boundary)", async () => {
    const tx = fakeTx({ schedule: open9to5 })
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(9), day(9, 30))
    ).resolves.toBeUndefined()
  })

  it("rejects a start before opening time", async () => {
    const tx = fakeTx({ schedule: open9to5 })
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(8, 30), day(9, 30))
    ).rejects.toThrow(ERR_OUTSIDE_WORKING_HOURS)
  })

  it("rejects an end after closing time", async () => {
    const tx = fakeTx({ schedule: open9to5 })
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(16, 30), day(17, 30))
    ).rejects.toThrow(ERR_OUTSIDE_WORKING_HOURS)
  })

  it("rejects when the staff member has no working schedule that day", async () => {
    const tx = fakeTx({ schedule: null })
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(10), day(11))
    ).rejects.toThrow(ERR_OUTSIDE_WORKING_HOURS)
  })
})

describe("assertSlotAllowed — approved time off", () => {
  it("rejects when overlapping a full-day time off (no start/end time)", async () => {
    const tx = fakeTx({
      schedule: open9to5,
      timeOff: { startTime: null, endTime: null },
    })
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(10), day(11))
    ).rejects.toThrow(ERR_ON_APPROVED_TIME_OFF)
  })

  it("rejects when overlapping a partial-day time off window", async () => {
    const tx = fakeTx({
      schedule: open9to5,
      timeOff: { startTime: t(12), endTime: t(13) }, // lunch PTO
    })
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(12, 30), day(13, 15))
    ).rejects.toThrow(ERR_ON_APPROVED_TIME_OFF)
  })

  it("passes when the slot is adjacent to (not overlapping) a partial time off", async () => {
    const tx = fakeTx({
      schedule: open9to5,
      timeOff: { startTime: t(12), endTime: t(13) },
    })
    // ends exactly when PTO starts — no overlap
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(11), day(12))
    ).resolves.toBeUndefined()
    // starts exactly when PTO ends — no overlap
    await expect(
      assertSlotAllowed(tx, STAFF, LOC, day(13), day(14))
    ).resolves.toBeUndefined()
  })
})
