import { describe, it, expect, vi, beforeEach } from "vitest"

// Two timezone residuals closed here (re-verify follow-up):
//
// GAP 1 — every authenticated/internal/MCP/v1 booking write path must thread the
// SALON's IANA timezone into assertSlotAllowed (the 6th arg). Omitting it
// silently defaults to UTC, which is correct only on a UTC host. We prove the
// salon timezone is threaded on TWO representative internal write paths:
// createAppointment (server action) and the MCP `create-appointment` tool, by
// spying on assertSlotAllowed and asserting the 6th argument.
//
// GAP 2 — appointment-time emails must render in the SALON's timezone, not the
// server's. On a UTC host a 9:00 America/New_York appointment would otherwise
// render "1:00 PM". We prove the shared email format function renders "9:00 AM"
// for a 9:00 ET instant. Like tests/scheduling-timezone.test.ts the math is
// host-TZ-independent by construction (Intl + explicit timeZone), and the
// `pnpm test:tz` script exercises it under TZ=UTC and TZ=America/New_York.

const BIZ = "11111111-1111-4111-8111-111111111111"
const CLIENT = "44444444-4444-4444-8444-444444444444"
const STAFF = "55555555-5555-4555-8555-555555555555"
const SERVICE = "66666666-6666-4666-8666-666666666666"
const LOCATION = "77777777-7777-4777-8777-777777777777"

const NY = "America/New_York"

// Spy that stands in for the REAL assertSlotAllowed. It resolves (guard passes)
// so the write path proceeds, and records every call so we can assert the
// timezone arg. The error sentinels are re-exported from the real module so the
// action's catch-branches keep their identity.
const { assertSlotAllowedSpy } = vi.hoisted(() => ({
  // Typed with the real assertSlotAllowed signature so `call[5]` (the timezone)
  // is a valid tuple index under tsc --noEmit.
  assertSlotAllowedSpy: vi.fn(
    async (
      _tx: unknown,
      _staffId: string,
      _locationId: string,
      _start: Date,
      _end: Date,
      _timezone?: string,
    ): Promise<void> => undefined,
  ),
}))

vi.mock("@/lib/scheduling/working-hours", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scheduling/working-hours")>(
    "@/lib/scheduling/working-hours",
  )
  return {
    ...actual,
    assertSlotAllowed: assertSlotAllowedSpy,
  }
})

vi.mock("@/lib/auth-utils", () => ({
  getBusinessContext: vi.fn(async () => ({ businessId: BIZ, userId: "user_1", role: "admin" })),
}))

vi.mock("@/lib/ownership", () => ({
  assertClientOwned: vi.fn(async () => undefined),
  assertStaffOwned: vi.fn(async () => undefined),
  generateBookingReference: vi.fn(() => "BK-1"),
}))

vi.mock("@/lib/booking-reference", () => ({
  generateBookingReference: vi.fn(() => "BK-1"),
}))

vi.mock("@/lib/db/advisory-lock", () => ({
  lockStaffSchedule: vi.fn(async () => undefined),
  isBookingContentionError: vi.fn(() => false),
}))

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => undefined) }))
vi.mock("@/lib/email-templates", () => ({
  bookingConfirmationEmail: vi.fn(() => ""),
  appointmentCancelledEmail: vi.fn(() => ""),
  appointmentRescheduledEmail: vi.fn(() => ""),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/permissions", () => ({ hasRole: vi.fn(() => true) }))
vi.mock("@/lib/api/appointment-access", () => ({
  canAccessAppointment: vi.fn(async () => true),
  canAccessAppointmentSeries: vi.fn(async () => true),
}))

// A fake tx whose reads return "no conflict". assertSlotAllowed itself is the
// spy above, so these reads are only exercised by the conflict check.
function makeTx() {
  return {
    staffSchedule: { findFirst: vi.fn(async () => null) },
    staffTimeOff: { findFirst: vi.fn(async () => null) },
    appointmentService: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "as_1" })),
    },
    appointment: { create: vi.fn(async () => ({ id: "appt_1", bookingReference: "BK-1" })) },
  }
}

const SERVICE_ROW = {
  id: SERVICE,
  name: "Haircut",
  durationMinutes: 45,
  price: 40,
  isTaxable: false,
  taxRate: null,
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: {
      findMany: vi.fn(async () => [SERVICE_ROW]),
      findFirst: vi.fn(async () => SERVICE_ROW),
    },
    // The salon runs in America/New_York — the value every write path must thread.
    business: {
      findUnique: vi.fn(async () => ({
        id: BIZ,
        name: "Shop",
        email: null,
        phone: null,
        timezone: NY,
      })),
    },
    location: { findFirst: vi.fn(async () => ({ id: LOCATION })) },
    client: {
      findUnique: vi.fn(async () => ({ id: CLIENT, firstName: "A", lastName: "B", email: null })),
      findFirst: vi.fn(async () => ({ id: CLIENT, firstName: "A", lastName: "B", email: null })),
    },
    staff: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => ({ id: STAFF, userId: "user_1" })),
    },
    $transaction: vi.fn(async (cb: (tx: ReturnType<typeof makeTx>) => unknown) => cb(makeTx())),
  },
}))

import { createAppointment } from "@/lib/actions/appointments"
import { registerAppointmentTools } from "@/lib/mcp/tools/appointments"
import { formatInZone } from "@/lib/scheduling/zoned-time"

// Wednesday 2026-06-03 13:00Z == 09:00 America/New_York (EDT).
const NY_9AM = new Date(Date.UTC(2026, 5, 3, 13, 0, 0, 0))

const baseInput = {
  clientId: CLIENT,
  serviceId: SERVICE,
  staffId: STAFF,
  startTime: NY_9AM.toISOString(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GAP 1 — salon timezone threaded into assertSlotAllowed", () => {
  it("createAppointment passes the salon timezone as the 6th arg", async () => {
    const result = await createAppointment(baseInput)
    expect(result.success).toBe(true)
    expect(assertSlotAllowedSpy).toHaveBeenCalledTimes(1)
    // assertSlotAllowed(tx, staffId, locationId, start, end, timezone)
    const call = assertSlotAllowedSpy.mock.calls[0]
    expect(call[5]).toBe(NY)
  })

  it("MCP create-appointment tool passes the salon timezone as the 6th arg", async () => {
    // Capture the handler the tool registers on a fake McpServer.
    type ToolHandler = (args: Record<string, unknown>) => Promise<{
      content: { type: "text"; text: string }[]
      isError?: boolean
    }>
    let handler: ToolHandler | undefined
    const fakeServer = {
      tool: (name: string, _desc: string, _schema: unknown, h: ToolHandler) => {
        if (name === "create-appointment") handler = h
      },
    }
    registerAppointmentTools(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeServer as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { userId: "user_1", businessId: BIZ, role: "admin" } as any,
    )
    if (!handler) throw new Error("create-appointment tool not registered")

    const res = await handler({
      clientId: CLIENT,
      serviceId: SERVICE,
      staffId: STAFF,
      startTime: NY_9AM.toISOString(),
    })
    expect(res.isError).toBeFalsy()
    expect(assertSlotAllowedSpy).toHaveBeenCalledTimes(1)
    const call = assertSlotAllowedSpy.mock.calls[0]
    expect(call[5]).toBe(NY)
  })
})

describe("GAP 2 — appointment-time emails render in the salon timezone", () => {
  // The exact options every confirmation/reschedule/cancel/reminder email uses.
  const EMAIL_OPTS: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }

  it("renders a 9:00 America/New_York appointment as 9:00 AM (not 1:00 PM)", () => {
    const rendered = formatInZone(NY_9AM, NY, EMAIL_OPTS)
    expect(rendered).toContain("9:00 AM")
    expect(rendered).not.toContain("1:00 PM")
    // Same salon-local civil day regardless of the host's UTC offset.
    expect(rendered).toContain("June 3, 2026")
  })

  it("renders a winter (EST) 9:00 ET appointment as 9:00 AM", () => {
    // 2026-01-07 14:00Z == 09:00 ET (EST, UTC-5).
    const winter = new Date(Date.UTC(2026, 0, 7, 14, 0, 0, 0))
    const rendered = formatInZone(winter, NY, EMAIL_OPTS)
    expect(rendered).toContain("9:00 AM")
    expect(rendered).toContain("January 7, 2026")
  })

  it("falls back to UTC wall-clock when timezone is empty", () => {
    const rendered = formatInZone(NY_9AM, "", EMAIL_OPTS)
    // 13:00Z renders as 1:00 PM under the UTC fallback.
    expect(rendered).toContain("1:00 PM")
  })
})
