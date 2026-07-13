import { describe, it, expect, beforeEach, vi } from "vitest"

// Booking audit L-033: the v1 recurring ROUTE advanced occurrences with plain
// date-fns addWeeks/addMonths on a UTC host, so a standing series drifted an hour
// across DST (the 3rd instance after the server action L-025 + MCP tool L-026). It
// now uses the shared salon-timezone-anchored generateRecurrenceDates helper. This
// drives the real POST handler over mocked auth + prisma and asserts the created
// occurrence start times stay at the same salon-local wall-clock across DST.

const H = vi.hoisted(() => ({
  withV1Auth: vi.fn(),
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

vi.mock("@/lib/api/auth", () => ({ withV1Auth: (...a: unknown[]) => H.withV1Auth(...a) }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: { findFirst: (...a: unknown[]) => H.serviceFindFirst(...a) },
    client: { findFirst: (...a: unknown[]) => H.clientFindFirst(...a) },
    staff: { findFirst: (...a: unknown[]) => H.staffFindFirst(...a) },
    location: { findFirst: (...a: unknown[]) => H.locationFindFirst(...a) },
    business: { findUnique: (...a: unknown[]) => H.businessFindUnique(...a) },
    $transaction: (fn: (tx: unknown) => unknown, opts: unknown) => H.transaction(fn, opts),
  },
}))
vi.mock("@/lib/scheduling/working-hours", () => ({
  assertSlotAllowed: (...a: unknown[]) => H.assertSlotAllowed(...a),
  ERR_OUTSIDE_WORKING_HOURS: "ERR_OUTSIDE_WORKING_HOURS",
  ERR_ON_APPROVED_TIME_OFF: "ERR_ON_APPROVED_TIME_OFF",
}))

import { POST } from "@/app/api/v1/appointments/recurring/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const SVC = "22222222-2222-4222-8222-222222222222"
const STAFF = "33333333-3333-4333-8333-333333333333"
const CLIENT = "44444444-4444-4444-8444-444444444444"

function post(body: unknown) {
  return new Request("http://localhost/api/v1/appointments/recurring", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  H.withV1Auth.mockResolvedValue({ businessId: BIZ, userId: "u1", role: "admin" })
  H.serviceFindFirst.mockResolvedValue({ id: SVC, businessId: BIZ, durationMinutes: 30, price: 40, isTaxable: false, taxRate: null, name: "Cut" })
  H.clientFindFirst.mockResolvedValue({ id: CLIENT })
  H.staffFindFirst.mockResolvedValue({ id: STAFF })
  H.locationFindFirst.mockResolvedValue({ id: "loc" })
  H.businessFindUnique.mockResolvedValue({ timezone: "America/New_York" })
  H.assertSlotAllowed.mockResolvedValue(undefined)
  H.txApptSvcFindFirst.mockResolvedValue(null)
  H.txApptSvcCreate.mockResolvedValue({})
  H.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      $executeRaw: (...a: unknown[]) => H.txExecuteRaw(...a),
      appointmentService: { findFirst: (...a: unknown[]) => H.txApptSvcFindFirst(...a), create: (...a: unknown[]) => H.txApptSvcCreate(...a) },
      appointment: { create: (...a: unknown[]) => H.txApptCreate(...a) },
    }),
  )
})

describe("v1 recurring route — DST-safe occurrence generation (audit L-033)", () => {
  it("keeps a weekly 9 AM NY series at 9 AM local across the 2026-03-08 spring-forward", async () => {
    const starts: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    H.txApptCreate.mockImplementation(async (args: any) => {
      starts.push((args.data.startTime as Date).toISOString())
      return { id: `appt-${starts.length}` }
    })

    const res = await POST(
      post({
        clientId: CLIENT,
        serviceId: SVC,
        staffId: STAFF,
        startTime: "2026-03-02T14:00:00Z", // 9:00 AM EST
        recurrenceRule: "weekly",
        recurrenceEndDate: "2026-03-16T23:59:59Z", // 03-02, 03-09, 03-16
      }),
    )

    expect(res.status).toBe(201)
    expect(starts).toEqual([
      "2026-03-02T14:00:00.000Z", // 9 AM EST
      "2026-03-09T13:00:00.000Z", // 9 AM EDT after DST — NOT the drifted 14:00Z
      "2026-03-16T13:00:00.000Z",
    ])
  })
})
