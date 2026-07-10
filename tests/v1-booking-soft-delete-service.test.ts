import { describe, it, expect, beforeEach, vi } from "vitest"

// Booking audit L-031: the v1 group + recurring booking routes looked up the
// service WITHOUT deletedAt:null, so an API-key holder could book a soft-deleted
// service (stale name/price/duration) — every other booking path filters it out.
// Now both scope to deletedAt:null. We mock v1 auth + prisma.service.findFirst,
// POST a valid body, and assert the lookup is scoped (a soft-deleted service,
// returned as null, yields 404 and never books).

const { serviceFindFirst, withV1AuthMock } = vi.hoisted(() => ({
  serviceFindFirst: vi.fn(),
  withV1AuthMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { service: { findFirst: (...a: unknown[]) => serviceFindFirst(...a) } } }))
vi.mock("@/lib/api/auth", () => ({ withV1Auth: (...a: unknown[]) => withV1AuthMock(...a) }))

import { POST as groupsPOST } from "@/app/api/v1/appointments/groups/route"
import { POST as recurringPOST } from "@/app/api/v1/appointments/recurring/route"

const BIZ = "11111111-1111-4111-8111-111111111111"
const SVC = "22222222-2222-4222-8222-222222222222"
const STAFF = "33333333-3333-4333-8333-333333333333"
const CLIENT = "44444444-4444-4444-8444-444444444444"

function post(body: unknown) {
  return new Request("http://localhost/api/v1/appointments/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function whereOf() {
  return (serviceFindFirst.mock.calls[0]![0] as { where: { id: string; businessId: string; deletedAt: unknown } }).where
}

beforeEach(() => {
  vi.clearAllMocks()
  withV1AuthMock.mockResolvedValue({ businessId: BIZ, userId: "u1", role: "admin" })
  // A soft-deleted (or absent) service resolves to null under the scoped lookup.
  serviceFindFirst.mockResolvedValue(null)
})

describe("v1 group + recurring booking — a soft-deleted service is not bookable (audit L-031)", () => {
  it("groups route scopes the service lookup to deletedAt:null → soft-deleted service 404s", async () => {
    const res = await groupsPOST(
      post({ serviceId: SVC, staffId: STAFF, startTime: "2026-07-10T14:00:00Z", maxParticipants: 3, clientIds: [CLIENT] }),
    )
    expect(res.status).toBe(404)
    expect(serviceFindFirst).toHaveBeenCalledTimes(1)
    expect(whereOf().deletedAt).toBe(null)
    expect(whereOf().businessId).toBe(BIZ)
  })

  it("recurring route scopes the service lookup to deletedAt:null → soft-deleted service 404s", async () => {
    const res = await recurringPOST(
      post({
        clientId: CLIENT,
        serviceId: SVC,
        staffId: STAFF,
        startTime: "2026-07-10T14:00:00Z",
        recurrenceRule: "weekly",
        recurrenceEndDate: "2026-08-10T14:00:00Z",
      }),
    )
    expect(res.status).toBe(404)
    expect(serviceFindFirst).toHaveBeenCalledTimes(1)
    expect(whereOf().deletedAt).toBe(null)
  })
})
