import { describe, it, expect } from "vitest"
import { assertSlotAllowed } from "@/lib/scheduling/working-hours"

// P2-6 — a staffer can have MULTIPLE approved partial-day time-off blocks on one
// day (e.g. 9-10 AND 14-15). The guard must check every block, not just the first
// one a query returns, or a booking can land on the second block.

function time(h: number, m = 0) {
  return new Date(Date.UTC(1970, 0, 1, h, m, 0))
}

const NY = "America/New_York"

function fakeTx(timeOffs: Array<{ startTime: Date | null; endTime: Date | null }>) {
  return {
    staffSchedule: {
      findFirst: async () => ({ startTime: time(9), endTime: time(17), breaks: [] }),
    },
    staffTimeOff: { findMany: async () => timeOffs },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// 2026-06-03 (EDT). 14:00 ET == 18:00Z.
const start2pm = new Date("2026-06-03T18:00:00.000Z")
const end245pm = new Date("2026-06-03T18:45:00.000Z")

describe("assertSlotAllowed — multiple same-day time-off blocks", () => {
  it("rejects a booking that lands on the SECOND block (9-10 AND 14-15)", async () => {
    const tx = fakeTx([
      { startTime: time(9), endTime: time(10) },
      { startTime: time(14), endTime: time(15) },
    ])
    await expect(
      assertSlotAllowed(tx, "staff_1", "loc_1", start2pm, end245pm, NY)
    ).rejects.toThrow(/TIME_OFF/)
  })

  it("allows a booking that misses all blocks", async () => {
    const tx = fakeTx([
      { startTime: time(9), endTime: time(10) },
      { startTime: time(11), endTime: time(12) },
    ])
    await expect(
      assertSlotAllowed(tx, "staff_1", "loc_1", start2pm, end245pm, NY)
    ).resolves.toBeUndefined()
  })
})
