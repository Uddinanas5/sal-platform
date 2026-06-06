import { describe, it, expect, beforeEach, vi } from "vitest"

// GROUP C — BOOKING + LIMITS + minor hardening. Three mock-Prisma suites (no DB):
//
//  1. MCP reschedule-appointment (mcp/tools/appointments.ts) must shift EVERY
//     AppointmentService row by the same delta — a multi-service appointment
//     (cut+beard+lineup) must not leave services[1..N] orphaned at the old slot,
//     and the appointment block must be sized by totalDuration, not services[0].
//  2. The automated-message engine (automation/automated-messages.ts) must cap
//     the per-message-per-run recipient set (mirroring the campaign sender's
//     500-cap) and defer the overflow to a later tick.
//  3. issueGiftCard (actions/gift-cards.ts) maps a P2002 unique-constraint
//     collision to a friendly message; gift codes are unique PER TENANT, so two
//     different businesses issuing the same code never collide.
//
// vi.hoisted pattern (copied from tests/checkout-loyalty.test.ts /
// tests/group-a-tenant-authz.test.ts). vi.mock factories are hoisted above
// imports, so every symbol they reference comes from vi.hoisted.

// Valid v4 UUIDs (version "4" + variant "8/9/a/b" nibbles — Zod's .uuid()).
const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"
const USER = "55555555-5555-4555-8555-555555555555"
const APPT = "22222222-2222-4222-8222-222222222222"
const STAFF = "33333333-3333-4333-8333-333333333333"
const AS_CUT = "44444444-4444-4444-8444-444444444444"
const AS_BEARD = "66666666-6666-4666-8666-666666666666"
const AS_LINEUP = "77777777-7777-4777-8777-777777777777"

// ===========================================================================
// SHARED HOISTED MOCKS
// ===========================================================================
const {
  prismaMock,
  requireMinRoleMock,
  getBusinessContextMock,
  canAccessAppointmentMock,
  apptServiceUpdateMock,
  apptUpdateMock,
} = vi.hoisted(() => {
  const apptServiceUpdateMock = vi.fn(
    async (_args: { where: { id: string }; data: { startTime: Date; endTime: Date } }) => ({}),
  )
  const apptUpdateMock = vi.fn(
    async (args: { where: unknown; data: { startTime: Date; endTime: Date } }) => ({ id: "appt", ...args }),
  )
  const prismaMock = {
    appointment: { findFirst: vi.fn(), updateMany: vi.fn() },
    staff: { findFirst: vi.fn() },
    giftCard: { findFirst: vi.fn(), create: vi.fn() },
    business: { findUnique: vi.fn() },
    client: { findMany: vi.fn() },
    automatedMessage: { findMany: vi.fn(), update: vi.fn() },
    notification: { findMany: vi.fn(), create: vi.fn() },
    // $transaction runs the callback against a tx exposing the booking write
    // surface; the conflict check returns null (no collision) by default.
    $transaction: vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (cb: (tx: unknown) => unknown, ..._rest: any[]) =>
        cb({
          appointmentService: {
            findFirst: vi.fn(async () => null),
            update: apptServiceUpdateMock,
          },
          appointment: { update: apptUpdateMock },
        }),
    ),
  }
  return {
    prismaMock,
    requireMinRoleMock: vi.fn(),
    getBusinessContextMock: vi.fn(),
    canAccessAppointmentMock: vi.fn(),
    apptServiceUpdateMock,
    apptUpdateMock,
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({
  requireMinRole: requireMinRoleMock,
  getBusinessContext: getBusinessContextMock,
}))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => ({ success: true })) }))
vi.mock("@/lib/email-templates", () => ({ marketingEmail: vi.fn(() => "<html>") }))
vi.mock("@/lib/db/advisory-lock", () => ({
  lockStaffSchedule: vi.fn(),
  lockGiftCard: vi.fn(),
  lockClient: vi.fn(),
  isBookingContentionError: vi.fn(() => false),
}))
// Permissive working-hours guard: this suite proves the SERVICE-SHIFT mechanics
// of MCP reschedule, not the (separately-tested) working-hours gate. Keep the
// sentinels real so the tool's error mapping still type-checks.
vi.mock("@/lib/scheduling/working-hours", () => ({
  assertSlotAllowed: vi.fn(async () => undefined),
  ERR_OUTSIDE_WORKING_HOURS: "OUTSIDE_WORKING_HOURS",
  ERR_ON_APPROVED_TIME_OFF: "ON_APPROVED_TIME_OFF",
}))
vi.mock("@/lib/api/appointment-access", () => ({
  canAccessAppointment: canAccessAppointmentMock,
  canAccessAppointmentSeries: vi.fn(async () => true),
}))

import { registerAppointmentTools } from "@/lib/mcp/tools/appointments"
import { issueGiftCard } from "@/lib/actions/gift-cards"
import {
  runDueAutomatedMessages,
  AUTOMATED_MESSAGE_RECIPIENT_CAP,
} from "@/lib/automation/automated-messages"
import { AutomatedMessageTrigger } from "@/generated/prisma"
import { Prisma } from "@/generated/prisma"

beforeEach(() => {
  vi.clearAllMocks()
  requireMinRoleMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
  getBusinessContextMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
  canAccessAppointmentMock.mockResolvedValue(true)
})

// ===========================================================================
// 1. MCP reschedule-appointment — moves ALL service rows
// ===========================================================================
type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: "text"; text: string }[]
  isError?: boolean
}>

function loadRescheduleTool(ctx: { userId: string; businessId: string; role: string }) {
  let handler: ToolHandler | undefined
  const fakeServer = {
    tool: (name: string, _d: string, _s: unknown, h: ToolHandler) => {
      if (name === "reschedule-appointment") handler = h
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAppointmentTools(fakeServer as any, ctx as any)
  if (!handler) throw new Error("reschedule-appointment tool not registered")
  return handler
}

const parse = (out: { content: { text: string }[] }) => JSON.parse(out.content[0].text)

describe("MCP reschedule-appointment — multi-service integrity", () => {
  // A cut (30m) + beard (20m) + lineup (10m) appointment laid out back-to-back
  // from 10:00, on the SAME staff. Original block 10:00–11:00 (60m total).
  const ORIG_START = new Date("2026-06-10T10:00:00.000Z")
  function multiServiceAppointment() {
    return {
      id: APPT,
      businessId: BIZ,
      locationId: "loc_1",
      startTime: ORIG_START,
      totalDuration: 60,
      services: [
        {
          id: AS_CUT,
          staffId: STAFF,
          durationMinutes: 30,
          startTime: new Date("2026-06-10T10:00:00.000Z"),
          endTime: new Date("2026-06-10T10:30:00.000Z"),
        },
        {
          id: AS_BEARD,
          staffId: STAFF,
          durationMinutes: 20,
          startTime: new Date("2026-06-10T10:30:00.000Z"),
          endTime: new Date("2026-06-10T10:50:00.000Z"),
        },
        {
          id: AS_LINEUP,
          staffId: STAFF,
          durationMinutes: 10,
          startTime: new Date("2026-06-10T10:50:00.000Z"),
          endTime: new Date("2026-06-10T11:00:00.000Z"),
        },
      ],
    }
  }

  it("shifts EVERY service row by the same delta (no orphaned rows at the old slot)", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(multiServiceAppointment())
    const handler = loadRescheduleTool({ userId: USER, businessId: BIZ, role: "admin" })

    // Move 10:00 -> 14:00 the same day: a +4h delta.
    const NEW_START = new Date("2026-06-10T14:00:00.000Z")
    const out = await handler({ id: APPT, newStartTime: NEW_START.toISOString() })

    expect(out.isError).toBeUndefined()

    // All THREE service rows were updated (not just services[0]).
    expect(apptServiceUpdateMock).toHaveBeenCalledTimes(3)
    const updates = apptServiceUpdateMock.mock.calls.map(
      (c) => c[0] as { where: { id: string }; data: { startTime: Date; endTime: Date } },
    )
    const byId = Object.fromEntries(updates.map((u) => [u.where.id, u.data]))

    const FOUR_H = 4 * 60 * 60 * 1000
    // Cut: 10:00–10:30 -> 14:00–14:30
    expect(byId[AS_CUT].startTime.getTime()).toBe(ORIG_START.getTime() + FOUR_H)
    expect(byId[AS_CUT].endTime.getTime()).toBe(new Date("2026-06-10T10:30:00.000Z").getTime() + FOUR_H)
    // Beard: 10:30–10:50 -> 14:30–14:50 (NOT left at the old slot)
    expect(byId[AS_BEARD].startTime.getTime()).toBe(new Date("2026-06-10T10:30:00.000Z").getTime() + FOUR_H)
    expect(byId[AS_BEARD].endTime.getTime()).toBe(new Date("2026-06-10T10:50:00.000Z").getTime() + FOUR_H)
    // Lineup: 10:50–11:00 -> 14:50–15:00 (NOT left at the old slot)
    expect(byId[AS_LINEUP].startTime.getTime()).toBe(new Date("2026-06-10T10:50:00.000Z").getTime() + FOUR_H)
    expect(byId[AS_LINEUP].endTime.getTime()).toBe(new Date("2026-06-10T11:00:00.000Z").getTime() + FOUR_H)
  })

  it("sizes the appointment block by totalDuration (60m), not the first service (30m)", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(multiServiceAppointment())
    const handler = loadRescheduleTool({ userId: USER, businessId: BIZ, role: "admin" })

    const NEW_START = new Date("2026-06-10T14:00:00.000Z")
    await handler({ id: APPT, newStartTime: NEW_START.toISOString() })

    expect(apptUpdateMock).toHaveBeenCalledTimes(1)
    const data = (apptUpdateMock.mock.calls[0][0] as { data: { startTime: Date; endTime: Date } }).data
    expect(data.startTime.getTime()).toBe(NEW_START.getTime())
    // 14:00 + 60min = 15:00 (would wrongly be 14:30 if it used services[0]'s 30m).
    expect(data.endTime.getTime()).toBe(new Date("2026-06-10T15:00:00.000Z").getTime())
  })

  it("rejects when any shifted row collides with another booking (writes nothing)", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(multiServiceAppointment())
    // Make the conflict check return a hit for every row.
    prismaMock.$transaction.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (cb: (tx: unknown) => unknown, ..._rest: any[]) =>
        cb({
          appointmentService: {
            findFirst: vi.fn(async () => ({ id: "conflict" })),
            update: apptServiceUpdateMock,
          },
          appointment: { update: apptUpdateMock },
        }),
    )
    const handler = loadRescheduleTool({ userId: USER, businessId: BIZ, role: "admin" })

    const out = await handler({ id: APPT, newStartTime: "2026-06-10T14:00:00.000Z" })

    expect(out.isError).toBe(true)
    expect(parse(out).error).toMatch(/already booked/i)
    expect(apptServiceUpdateMock).not.toHaveBeenCalled()
    expect(apptUpdateMock).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// 2. Automated-message engine — per-run recipient cap
// ===========================================================================
describe("runDueAutomatedMessages — recipient cap", () => {
  function winBackMessage() {
    return {
      id: "m-winback",
      businessId: BIZ,
      trigger: AutomatedMessageTrigger.win_back,
      channel: "email",
      subject: "We miss you",
      body: "Come back to {businessName}.",
      business: { name: "Anas Cuts", timezone: "UTC" },
    }
  }

  it("requests at most CAP+1 candidates (bounded like the campaign sender)", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([winBackMessage()])
    prismaMock.client.findMany.mockResolvedValue([])
    prismaMock.notification.findMany.mockResolvedValue([])

    await runDueAutomatedMessages(new Date("2026-06-06T12:00:00.000Z"))

    expect(prismaMock.client.findMany.mock.calls[0][0].take).toBe(
      AUTOMATED_MESSAGE_RECIPIENT_CAP + 1,
    )
  })

  it("processes only CAP candidates per run and defers the overflow", async () => {
    prismaMock.automatedMessage.findMany.mockResolvedValue([winBackMessage()])
    // Return CAP + 5 lapsed clients (one over the +1 we fetch would be ignored
    // by `take`, but the engine slices to CAP regardless of how many it sees).
    const overflow = AUTOMATED_MESSAGE_RECIPIENT_CAP + 5
    const lapsed = new Date("2024-01-01T00:00:00.000Z")
    const candidates = Array.from({ length: overflow }, (_, i) => ({
      id: `client-${i}`,
      email: `c${i}@example.com`,
      firstName: "C",
      lastName: String(i),
      dateOfBirth: null,
      lastVisitAt: lapsed,
    }))
    prismaMock.client.findMany.mockResolvedValue(candidates)
    prismaMock.notification.findMany.mockResolvedValue([]) // nothing stamped yet
    prismaMock.notification.create.mockResolvedValue({ id: "n" })
    prismaMock.automatedMessage.update.mockResolvedValue({})

    const res = await runDueAutomatedMessages(new Date("2026-06-06T12:00:00.000Z"))

    // Exactly CAP candidates were processed (stamped + emailed) this tick.
    expect(res.candidatesScanned).toBe(AUTOMATED_MESSAGE_RECIPIENT_CAP)
    expect(res.emailsSent).toBe(AUTOMATED_MESSAGE_RECIPIENT_CAP)
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(AUTOMATED_MESSAGE_RECIPIENT_CAP)
    // The remainder was deferred, not sent.
    expect(res.deferredOverCap).toBe(overflow - AUTOMATED_MESSAGE_RECIPIENT_CAP)
  })
})

// ===========================================================================
// 3. issueGiftCard — per-tenant code uniqueness + friendly P2002
// ===========================================================================
describe("issueGiftCard — per-business code uniqueness", () => {
  it("lets two DIFFERENT businesses issue the SAME code without colliding", async () => {
    // Both businesses use "GIFT100". Each pre-check (findFirst) is tenant-scoped,
    // so neither sees the other's card, and each create succeeds.
    prismaMock.giftCard.findFirst.mockImplementation(
      async (args: { where: { businessId: string; code: string } }) => {
        // Tenant-scoped: a business never sees another tenant's card.
        void args
        return null
      },
    )
    prismaMock.business.findUnique.mockResolvedValue({ currency: "USD" })
    prismaMock.giftCard.create.mockImplementation(
      async (args: { data: { businessId: string; code: string } }) => ({
        id: `gc-${args.data.businessId}`,
        code: args.data.code,
      }),
    )

    // Business A issues GIFT100.
    requireMinRoleMock.mockResolvedValue({ businessId: BIZ, userId: USER, role: "admin" })
    const a = await issueGiftCard({ code: "GIFT100", initialValue: 100 })
    expect(a.success).toBe(true)
    expect(prismaMock.giftCard.create.mock.calls[0][0].data.businessId).toBe(BIZ)

    // Business B issues the SAME code — no collision.
    requireMinRoleMock.mockResolvedValue({ businessId: OTHER_BIZ, userId: USER, role: "admin" })
    const b = await issueGiftCard({ code: "GIFT100", initialValue: 50 })
    expect(b.success).toBe(true)
    expect(prismaMock.giftCard.create.mock.calls[1][0].data.businessId).toBe(OTHER_BIZ)
    // The pre-check for B was scoped to B's businessId, never trusting input.
    const bPreCheck = prismaMock.giftCard.findFirst.mock.calls[1][0].where
    expect(bPreCheck.businessId).toBe(OTHER_BIZ)
    expect(bPreCheck.code).toBe("GIFT100")
  })

  it("maps a Prisma P2002 on create to a friendly 'already exists' message", async () => {
    prismaMock.giftCard.findFirst.mockResolvedValue(null) // pre-check passes
    prismaMock.business.findUnique.mockResolvedValue({ currency: "USD" })
    // The create races/collides on the per-tenant unique index.
    prismaMock.giftCard.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.4.1",
      }),
    )

    const res = await issueGiftCard({ code: "GIFT100", initialValue: 100 })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("A gift card with this code already exists")
  })
})
