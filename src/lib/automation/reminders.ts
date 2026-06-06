import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { formatInZone } from "@/lib/scheduling/zoned-time"
import { AppointmentStatus } from "@/generated/prisma"

// ============================================================================
// "Never Miss Again" reminder backbone.
//
// This is the dispatch-side logic for SAL's headline promise. The cron route
// (src/app/api/cron/dispatch/route.ts) calls runDueReminders() on a schedule.
// Everything here is:
//   - IDEMPOTENT: we only pick appointments whose reminderSentAt is null and
//     stamp it the instant a reminder goes out, so a re-run (or overlapping
//     cron invocations) never double-sends.
//   - TENANT-SAFE: every appointment row already carries its own businessId.
//     We never read a tenant id from request input; the cron is a system actor
//     and processes whatever is genuinely due across all businesses. Each email
//     is built only from the appointment's own joined business/client data.
//   - BOUNDED: a hard cap on rows per run keeps a single cron tick cheap and
//     prevents a backlog from blowing the function timeout.
// ============================================================================

// Max appointments processed in a single cron tick. With a ~15-minute cadence
// this is comfortably more than any single salon will accrue between runs.
export const REMINDER_BATCH_CAP = 200

// The reminder window depends on the cron CADENCE (REMINDER_CADENCE env):
//
// • "daily" (DEFAULT — Vercel Hobby allows only a once-per-day cron): a single
//   day-ahead window covering every live appointment starting within the next
//   ~26h that hasn't been reminded yet. The reminderSentAt stamp guarantees each
//   appointment is reminded exactly once (~a day before), so a once-daily run
//   reliably delivers the day-before nudge without a tight ±15m window it would
//   otherwise miss between daily ticks. (Same-day <26h bookings made after a run
//   are caught by the next day's run if still >0h out.)
//
// • "frequent" (Vercel Pro — set REMINDER_CADENCE=frequent and the */15 cron):
//   the original two tight windows — a 24h±15m day-ahead nudge AND a 2h±15m
//   same-day nudge — for minute-grained delivery.
const HOUR_MS = 60 * 60 * 1000
const MIN_MS = 60 * 1000

export type ReminderWindow = {
  label: "24h" | "2h" | "day-ahead"
  start: Date
  end: Date
}

export function buildReminderWindows(now: Date = new Date()): ReminderWindow[] {
  const t = now.getTime()
  if (process.env.REMINDER_CADENCE === "frequent") {
    return [
      { label: "24h", start: new Date(t + 24 * HOUR_MS - 15 * MIN_MS), end: new Date(t + 24 * HOUR_MS + 15 * MIN_MS) },
      { label: "2h", start: new Date(t + 2 * HOUR_MS - 15 * MIN_MS), end: new Date(t + 2 * HOUR_MS + 15 * MIN_MS) },
    ]
  }
  // Daily default: one wide day-ahead window. Lower bound is +15m so we never
  // remind an appointment already in progress / seconds away; upper bound +26h
  // covers the full next day plus slack so nothing falls between daily ticks.
  return [
    { label: "day-ahead", start: new Date(t + 15 * MIN_MS), end: new Date(t + 26 * HOUR_MS) },
  ]
}

// Statuses that are "live" and therefore worth reminding about. We never remind
// cancelled / no_show / completed appointments. pending is included because a
// booked-but-unconfirmed slot still represents a real commitment we want to
// reduce no-shows on. Matches the codebase's idiomatic string-literal status
// filtering (see appointments.ts `status: { notIn: [...] }`).
const REMINDABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.pending,
  AppointmentStatus.confirmed,
]

// Shape we select. Kept narrow so the query is cheap and the test mock is small.
type DueAppointment = {
  id: string
  businessId: string
  startTime: Date
  bookingReference: string
  client: {
    email: string | null
    firstName: string
    lastName: string
    emailConsent: boolean
  } | null
  business: {
    name: string
    email: string | null
    phone: string | null
    timezone: string
  }
  services: { name: string }[]
}

export type ReminderRunResult = {
  windows: { label: string; due: number }[]
  scanned: number
  emailsSent: number
  skippedNoEmail: number
  skippedNoConsent: number
  stamped: number
}

/**
 * Find appointments that are due for a reminder in either window AND have not
 * yet been reminded. Scoped to live statuses only. Ordered by startTime so the
 * most imminent appointments are served first if we hit the batch cap.
 *
 * NOTE: this returns rows across ALL tenants — the cron is a trusted system
 * actor, not a tenant-scoped request. Tenant safety is preserved because every
 * row carries its own businessId and each email is rendered solely from that
 * row's own joined data (never from any shared/ambient context).
 */
export async function findDueReminders(
  windows: ReminderWindow[]
): Promise<DueAppointment[]> {
  return prisma.appointment.findMany({
    where: {
      reminderSentAt: null,
      status: { in: REMINDABLE_STATUSES },
      OR: windows.map((w) => ({
        startTime: { gte: w.start, lte: w.end },
      })),
    },
    orderBy: { startTime: "asc" },
    take: REMINDER_BATCH_CAP,
    select: {
      id: true,
      businessId: true,
      startTime: true,
      bookingReference: true,
      client: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          emailConsent: true,
        },
      },
      business: {
        select: { name: true, email: true, phone: true, timezone: true },
      },
      services: {
        select: { name: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  }) as unknown as Promise<DueAppointment[]>
}

/**
 * Atomically claim an appointment for reminding by stamping reminderSentAt only
 * if it is still null. The `reminderSentAt: null` guard in the where-clause is
 * the idempotency lock: if two cron ticks race, the second update matches zero
 * rows and we know not to send a duplicate. Returns true if THIS call won the
 * claim. businessId is included in the where to keep the write tenant-scoped to
 * the exact row we selected.
 */
async function claimReminder(
  appointmentId: string,
  businessId: string,
  sentAt: Date
): Promise<boolean> {
  const res = await prisma.appointment.updateMany({
    where: { id: appointmentId, businessId, reminderSentAt: null },
    data: { reminderSentAt: sentAt },
  })
  return res.count === 1
}

// Render the appointment time in the SALON's timezone, not the server's, so a
// 9am-ET appointment never reminds as "1:00 PM" on a UTC host.
function formatWhen(start: Date, timezone: string): string {
  return formatInZone(start, timezone, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

// Minimal, self-contained reminder email. Kept local to this module so the
// automation workstream owns its own copy and does not edit the shared
// email-templates.ts file. Plain inline-styled HTML, same visual language.
function reminderEmailHtml(opts: {
  clientName: string
  serviceName: string
  dateTime: string
  businessName: string
  bookingRef: string
  businessEmail?: string | null
  businessPhone?: string | null
}): string {
  const contact =
    opts.businessEmail || opts.businessPhone
      ? `<p style="margin:16px 0 0;font-size:14px;color:#6b6560;line-height:1.6;">Need to reschedule or cancel? Reach us at${
          opts.businessPhone ? ` <strong>${opts.businessPhone}</strong>` : ""
        }${opts.businessPhone && opts.businessEmail ? " or" : ""}${
          opts.businessEmail
            ? ` <a href="mailto:${opts.businessEmail}" style="color:#047857;">${opts.businessEmail}</a>`
            : ""
        }.</p>`
      : ""
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Appointment Reminder</title></head>
<body style="margin:0;padding:0;background-color:#f9f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f9f7f4;"><tr><td style="padding:40px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="padding:32px 40px 40px;">
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a1a;">Appointment Reminder</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6b6560;line-height:1.5;">Hi ${opts.clientName}, this is a friendly reminder about your upcoming appointment at <strong>${opts.businessName}</strong>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#faf8f5;border-radius:8px;margin-bottom:24px;"><tr><td style="padding:20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
            <tr><td style="padding:6px 0;"><span style="font-size:13px;color:#9a9590;text-transform:uppercase;letter-spacing:0.5px;">Service</span><br><span style="font-size:15px;color:#1a1a1a;font-weight:600;">${opts.serviceName}</span></td></tr>
            <tr><td style="padding:6px 0;"><span style="font-size:13px;color:#9a9590;text-transform:uppercase;letter-spacing:0.5px;">Date &amp; Time</span><br><span style="font-size:15px;color:#1a1a1a;font-weight:600;">${opts.dateTime}</span></td></tr>
            <tr><td style="padding:6px 0;"><span style="font-size:13px;color:#9a9590;text-transform:uppercase;letter-spacing:0.5px;">Booking Reference</span><br><span style="font-size:15px;color:#059669;font-weight:700;letter-spacing:0.5px;">${opts.bookingRef}</span></td></tr>
          </table>
        </td></tr></table>
        ${contact}
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

/**
 * Process all due reminders for this tick. For each due appointment with a
 * client email AND emailConsent:
 *   1. Claim it (atomic stamp of reminderSentAt) — wins the idempotency race.
 *   2. Only if the claim succeeded, send the email.
 * Stamping BEFORE sending is deliberate: an email provider hiccup must not
 * cause an infinite re-send loop. sendEmail itself is best-effort (it no-ops
 * and logs when Resend is unconfigured, e.g. on preview branches), so a failed
 * send is logged but the appointment stays stamped — matching the existing
 * "don't block on email failure" posture elsewhere in the codebase.
 *
 * SMS SEAM: when Twilio is ready, add a parallel branch here that checks the
 * client's phone + smsConsent and dispatches an SMS. It MUST be gated behind an
 * explicit env flag / feature gate and use its own claim (e.g. a separate
 * stamp) so email and SMS idempotency stay independent. Do NOT send SMS now.
 */
export async function runDueReminders(
  now: Date = new Date()
): Promise<ReminderRunResult> {
  const windows = buildReminderWindows(now)
  const due = await findDueReminders(windows)

  const result: ReminderRunResult = {
    windows: windows.map((w) => ({ label: w.label, due: 0 })),
    scanned: due.length,
    emailsSent: 0,
    skippedNoEmail: 0,
    skippedNoConsent: 0,
    stamped: 0,
  }

  for (const appt of due) {
    const client = appt.client
    if (!client?.email) {
      result.skippedNoEmail++
      continue
    }
    if (!client.emailConsent) {
      result.skippedNoConsent++
      continue
    }

    // Atomically claim. If we lose the race (another tick already stamped it),
    // skip without sending so we never double-send.
    const won = await claimReminder(appt.id, appt.businessId, now)
    if (!won) continue
    result.stamped++

    const serviceName =
      appt.services.length > 1
        ? `${appt.services[0]?.name} +${appt.services.length - 1} more`
        : appt.services[0]?.name || "Your appointment"

    try {
      await sendEmail({
        to: client.email,
        subject: `Reminder: ${serviceName} at ${appt.business.name}`,
        html: reminderEmailHtml({
          clientName: `${client.firstName} ${client.lastName}`.trim(),
          serviceName,
          dateTime: formatWhen(appt.startTime, appt.business.timezone),
          businessName: appt.business.name,
          bookingRef: appt.bookingReference,
          businessEmail: appt.business.email,
          businessPhone: appt.business.phone,
        }),
      })
      result.emailsSent++
    } catch (e) {
      // Already stamped above; log and move on. We intentionally do NOT roll
      // back the stamp — a transient provider error must not re-queue forever.
      console.error("[reminders] sendEmail failed", {
        appointmentId: appt.id,
        error: e,
      })
    }
    // TODO(SMS): when Twilio lands, add gated client.phone + client.smsConsent
    // SMS dispatch here behind a feature flag with its own idempotency stamp.
  }

  return result
}
