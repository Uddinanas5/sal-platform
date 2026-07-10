import { describe, it, expect, beforeEach, vi } from "vitest"

// Booking audit finding (P1): the MCP `update-appointment-status` tool used to do
// a bare prisma.appointment.update with NO conflict re-check, so reactivating a
// cancelled/no_show appointment (whose slot another booking had since taken) via
// an AI assistant silently double-booked the staff member — while the server
// action and v1 REST PATCH both guard exactly this transition. The tool now
// mirrors that REACTIVATION GUARD (advisory lock + in-tx conflict re-check). This
// captures the tool handler off a fake McpServer and drives it over a mock Prisma.

const { apptFindFirst, apptUpdate, txApptSvcFindFirst, txApptUpdate, txExecuteRaw, canAccess } = vi.hoisted(() => ({
  apptFindFirst: vi.fn(),
  apptUpdate: vi.fn(),
  txApptSvcFindFirst: vi.fn(),
  txApptUpdate: vi.fn(),
  txExecuteRaw: vi.fn(),
  canAccess: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: { findFirst: (...a: unknown[]) => apptFindFirst(...a), update: (...a: unknown[]) => apptUpdate(...a) },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        $executeRaw: (...a: unknown[]) => txExecuteRaw(...a),
        appointmentService: { findFirst: (...a: unknown[]) => txApptSvcFindFirst(...a) },
        appointment: { update: (...a: unknown[]) => txApptUpdate(...a) },
      }),
  },
}))
vi.mock("@/lib/api/appointment-access", () => ({
  canAccessAppointment: (...a: unknown[]) => canAccess(...a),
  canAccessAppointmentSeries: vi.fn(),
}))

import { registerAppointmentTools } from "@/lib/mcp/tools/appointments"

const BIZ = "11111111-1111-4111-8111-111111111111"
const STAFF = "22222222-2222-4222-8222-222222222222"
const APPT = "55555555-5555-4555-8555-555555555555"
const START = new Date("2026-07-10T14:00:00Z")
const END = new Date("2026-07-10T14:30:00Z")

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (args: any) => Promise<{ content: { text: string }[]; isError?: boolean }>

function loadTool(name: string): Handler {
  const handlers = new Map<string, Handler>()
  const fakeServer = { tool: (n: string, _d: string, _s: unknown, h: Handler) => handlers.set(n, h) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAppointmentTools(fakeServer as any, { businessId: BIZ, userId: "u1", role: "admin" } as any)
  return handlers.get(name)!
}

beforeEach(() => {
  vi.clearAllMocks()
  canAccess.mockResolvedValue(true)
})

describe("MCP update-appointment-status — reactivation guard (audit P1)", () => {
  it("REFUSES reactivating a cancelled appointment onto a now-occupied slot (no silent double-booking)", async () => {
    apptFindFirst.mockResolvedValue({ status: "cancelled", services: [{ staffId: STAFF, startTime: START, endTime: END }] })
    txApptSvcFindFirst.mockResolvedValue({ id: "conflicting-appt-service" }) // another booking took the freed slot

    const res = await loadTool("update-appointment-status")({ id: APPT, status: "confirmed" })

    expect(res.isError).toBe(true)
    expect(res.content[0].text).toMatch(/no longer free/)
    // The conflict was re-checked under the advisory lock, and NOTHING was written.
    expect(txExecuteRaw).toHaveBeenCalled()
    expect(txApptUpdate).not.toHaveBeenCalled()
    expect(apptUpdate).not.toHaveBeenCalled()
  })

  it("ALLOWS reactivation when the slot is still free (re-checks under the lock, then updates)", async () => {
    apptFindFirst.mockResolvedValue({ status: "cancelled", services: [{ staffId: STAFF, startTime: START, endTime: END }] })
    txApptSvcFindFirst.mockResolvedValue(null) // no conflict
    txApptUpdate.mockResolvedValue({ id: APPT, status: "confirmed" })

    const res = await loadTool("update-appointment-status")({ id: APPT, status: "confirmed" })

    expect(res.isError).toBeFalsy()
    expect(txExecuteRaw).toHaveBeenCalled() // advisory lock taken
    expect(txApptUpdate).toHaveBeenCalledTimes(1)
  })

  it("a non-reactivation transition (confirmed → completed) does a plain update, no conflict re-check", async () => {
    apptFindFirst.mockResolvedValue({ status: "confirmed", services: [{ staffId: STAFF, startTime: START, endTime: END }] })
    apptUpdate.mockResolvedValue({ id: APPT, status: "completed" })

    const res = await loadTool("update-appointment-status")({ id: APPT, status: "completed" })

    expect(res.isError).toBeFalsy()
    expect(apptUpdate).toHaveBeenCalledTimes(1) // plain (non-transactional) update path
    expect(txApptSvcFindFirst).not.toHaveBeenCalled() // no conflict re-check for a normal transition
  })
})
