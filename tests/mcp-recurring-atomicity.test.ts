import { describe, it, expect, beforeEach, vi } from "vitest"

// Booking audit finding (P2, L-024): MCP create-recurring-appointment wrapped each
// occurrence in its OWN transaction inside the loop, so a mid-series conflict left
// occurrences 1..N-1 COMMITTED (orphaned) while returning "nothing created". The
// server action + v1 route wrap the whole loop in ONE transaction. The tool now
// does too — atomic all-or-nothing. This captures the tool handler off a fake
// McpServer over a mock Prisma and asserts (a) the WHOLE series runs in ONE
// $transaction, and (b) a mid-series conflict returns an error rather than a
// partial booking.

const H = vi.hoisted(() => ({
  serviceFindFirst: vi.fn(),
  clientFindFirst: vi.fn(),
  staffFindFirst: vi.fn(),
  locationFindFirst: vi.fn(),
  businessFindUnique: vi.fn(),
  transaction: vi.fn(),
  txExecuteRaw: vi.fn(),
  txApptSvcFindFirst: vi.fn(),
  txApptCreate: vi.fn(),
  txApptSvcCreate: vi.fn(),
  assertSlotAllowed: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: { findFirst: (...a: unknown[]) => H.serviceFindFirst(...a) },
    client: { findFirst: (...a: unknown[]) => H.clientFindFirst(...a) },
    staff: { findFirst: (...a: unknown[]) => H.staffFindFirst(...a) },
    location: { findFirst: (...a: unknown[]) => H.locationFindFirst(...a) },
    business: { findUnique: (...a: unknown[]) => H.businessFindUnique(...a) },
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: (fn: (tx: unknown) => unknown, opts: unknown) => H.transaction(fn, opts),
  },
}))
vi.mock("@/lib/scheduling/working-hours", () => ({
  assertSlotAllowed: (...a: unknown[]) => H.assertSlotAllowed(...a),
  ERR_OUTSIDE_WORKING_HOURS: "ERR_OUTSIDE_WORKING_HOURS",
  ERR_ON_APPROVED_TIME_OFF: "ERR_ON_APPROVED_TIME_OFF",
}))
vi.mock("@/lib/api/appointment-access", () => ({
  canAccessAppointment: vi.fn(async () => true),
  canAccessAppointmentSeries: vi.fn(async () => true),
}))

import { registerAppointmentTools } from "@/lib/mcp/tools/appointments"

const BIZ = "11111111-1111-4111-8111-111111111111"
const SVC = "22222222-2222-4222-8222-222222222222"
const STAFF = "33333333-3333-4333-8333-333333333333"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const LOC = "55555555-5555-4555-8555-555555555555"
const START = new Date("2026-07-10T14:00:00Z")

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (args: any) => Promise<{ content: { text: string }[]; isError?: boolean }>

function loadTool(name: string): Handler {
  const handlers = new Map<string, Handler>()
  const fakeServer = { tool: (n: string, _d: string, _s: unknown, h: Handler) => handlers.set(n, h) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAppointmentTools(fakeServer as any, { businessId: BIZ, userId: "u1", role: "admin" } as any)
  return handlers.get(name)!
}

const seriesArgs = {
  clientId: CLIENT,
  serviceId: SVC,
  staffId: STAFF,
  startTime: START.toISOString(),
  recurrenceRule: "weekly" as const,
  recurrenceEndDate: "2026-07-24T23:59:59Z", // 3 weekly occurrences: 07-10, 07-17, 07-24
}

beforeEach(() => {
  vi.clearAllMocks()
  H.serviceFindFirst.mockResolvedValue({ id: SVC, businessId: BIZ, durationMinutes: 30, price: 40, name: "Cut" })
  H.clientFindFirst.mockResolvedValue({ id: CLIENT })
  H.staffFindFirst.mockResolvedValue({ id: STAFF, userId: "u1" })
  H.locationFindFirst.mockResolvedValue({ id: LOC })
  H.businessFindUnique.mockResolvedValue({ timezone: "UTC" })
  H.assertSlotAllowed.mockResolvedValue(undefined)
  H.txApptSvcFindFirst.mockResolvedValue(null)
  H.txApptCreate.mockImplementation(async () => ({ id: "appt", startTime: START }))
  H.txApptSvcCreate.mockResolvedValue({})
  // One tx wraps the whole series: run the callback with a single tx client.
  H.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      $executeRaw: (...a: unknown[]) => H.txExecuteRaw(...a),
      appointmentService: { findFirst: (...a: unknown[]) => H.txApptSvcFindFirst(...a), create: (...a: unknown[]) => H.txApptSvcCreate(...a) },
      appointment: { create: (...a: unknown[]) => H.txApptCreate(...a) },
    }),
  )
})

describe("MCP create-recurring-appointment — atomic series (audit L-024)", () => {
  it("books the WHOLE 3-occurrence series inside ONE transaction", async () => {
    const res = await loadTool("create-recurring-appointment")(seriesArgs)

    expect(res.isError).toBeFalsy()
    // ONE transaction for the whole series (atomic) — not one per occurrence.
    expect(H.transaction).toHaveBeenCalledTimes(1)
    // The advisory lock is taken once up front, and all 3 occurrences created within.
    expect(H.txExecuteRaw).toHaveBeenCalledTimes(1)
    expect(H.txApptCreate).toHaveBeenCalledTimes(3)
    const body = JSON.parse(res.content[0].text)
    expect(body.appointmentsCreated).toBe(3)
  })

  it("a mid-series conflict aborts the whole series (single tx → all-or-nothing), returning an error", async () => {
    // Occurrence 1 free, occurrence 2 conflicts.
    H.txApptSvcFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "conflict" })

    const res = await loadTool("create-recurring-appointment")(seriesArgs)

    expect(res.isError).toBe(true)
    expect(res.content[0].text).toMatch(/already booked/)
    // Still exactly ONE transaction wrapping the series — so the DB rolls back
    // occurrence 1 too (no orphaned partial series).
    expect(H.transaction).toHaveBeenCalledTimes(1)
  })
})
