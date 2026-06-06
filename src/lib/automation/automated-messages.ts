import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { marketingEmail } from "@/lib/email-templates"
import { renderNotificationTemplate } from "@/lib/notifications/render-template"
import { AutomatedMessageTrigger } from "@/generated/prisma"
import { INACTIVE_CLIENT_DAYS } from "@/lib/marketing/audience"

// ============================================================================
// Automated-message execution engine (daily-evaluable triggers).
//
// SAL's AutomatedMessage rows describe per-business email automations keyed off
// an AutomatedMessageTrigger. This engine runs once a day from the EXISTING cron
// (src/app/api/cron/dispatch/route.ts) and fires the triggers that can be
// honestly evaluated from a daily scan of client state:
//
//   • birthday          — clients whose date_of_birth month/day = "today" in the
//                          business's own timezone.
//   • win_back          — clients who have lapsed (lastVisitAt older than
//   • rebooking_reminder   INACTIVE_CLIENT_DAYS). Both are "you haven't been in a
//                          while, come back" nudges, so they share the lapsed
//                          audience semantics.
//
// Appointment-LINKED triggers (appointment_reminder, booking_confirmation,
// review_request, thank_you, no_show_followup, welcome) are NOT handled here:
// appointment_reminder is owned by src/lib/automation/reminders.ts, and the
// others fire from their own lifecycle hooks. Any AutomatedMessage with one of
// those triggers is treated as "covered elsewhere" and skipped (see
// COVERED_BY_OTHER_FLOWS below) so we never double-send.
//
// IDEMPOTENCY: every send is preceded by a Notification "stamp" carrying a
// deterministic occasion key (e.g. birthday:2026, win_back:<lastVisitAt>). We
// only send if no prior Notification exists for the same
// (business, client, message, occasion). The stamp is written BEFORE the email
// goes out — mirroring reminders.ts — so a provider hiccup can never re-queue
// the same occasion forever. The dispatch is a single daily cron (effectively
// single-threaded), so check-then-stamp is race-safe in practice; the stamp
// also makes a same-day re-run a no-op.
//
// CONSENT: birthday/win-back are marketing-style nudges. We require an email on
// file AND emailConsent AND marketingConsent — the same gate the campaign sender
// uses. SMS is never sent (beta): channel !== "email" rows are skipped.
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000

// A Notification.type tag distinguishing our automated-message stamps from any
// other notification kind. Combined with the per-trigger occasion key it gives
// us the dedup identity.
export const AUTOMATED_MESSAGE_NOTIFICATION_TYPE = "automated_message"

// Triggers this engine actively evaluates on a daily scan.
const DAILY_TRIGGERS: AutomatedMessageTrigger[] = [
  AutomatedMessageTrigger.birthday,
  AutomatedMessageTrigger.win_back,
  AutomatedMessageTrigger.rebooking_reminder,
]

// Triggers owned by other flows. We never fire these here — listing them keeps
// the "why is this skipped" answer explicit at the call site.
//   appointment_reminder  → src/lib/automation/reminders.ts
//   booking_confirmation  → public-booking / appointment lifecycle
//   review_request        → review collection loop
//   thank_you             → post-visit lifecycle
//   no_show_followup      → no-show lifecycle
//   welcome               → onboarding / first-visit lifecycle
const COVERED_BY_OTHER_FLOWS: AutomatedMessageTrigger[] = [
  AutomatedMessageTrigger.appointment_reminder,
  AutomatedMessageTrigger.booking_confirmation,
  AutomatedMessageTrigger.review_request,
  AutomatedMessageTrigger.thank_you,
  AutomatedMessageTrigger.no_show_followup,
  AutomatedMessageTrigger.welcome,
]

type ActiveMessage = {
  id: string
  businessId: string
  trigger: AutomatedMessageTrigger
  channel: string
  subject: string | null
  body: string
  business: { name: string; timezone: string }
}

type CandidateClient = {
  id: string
  email: string | null
  firstName: string
  lastName: string
  dateOfBirth: Date | null
  lastVisitAt: Date | null
}

export type AutomatedMessageRunResult = {
  messagesEvaluated: number
  skippedCoveredElsewhere: number
  skippedNonEmail: number
  candidatesScanned: number
  emailsSent: number
  skippedAlreadySent: number
  skippedNoEmailOrConsent: number
}

/**
 * Business-local month/day ("MM-DD") for an instant. Birthday matching is done
 * in the business's own timezone so a salon in Los Angeles doesn't fire a
 * client's birthday a day early off a UTC clock. Mirrors the localDateString
 * helper in record-checkout.ts.
 */
export function localMonthDay(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${get("month")}-${get("day")}`
}

/** Business-local year ("YYYY") — used to key a birthday to a calendar year. */
export function localYear(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(instant)
  return parts.find((p) => p.type === "year")?.value ?? String(instant.getUTCFullYear())
}

/** Month/day ("MM-DD") of a stored @db.Date birthday, read in UTC (dates are
 * stored at UTC midnight) so the comparison is calendar-stable. */
export function birthdayMonthDay(dob: Date): string {
  const mm = String(dob.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(dob.getUTCDate()).padStart(2, "0")
  return `${mm}-${dd}`
}

/**
 * True if `dob` falls on `now` (month + day) in the given business timezone.
 * Pure + exported so the matcher is unit-testable without a DB.
 */
export function isBirthdayToday(dob: Date, now: Date, timezone: string): boolean {
  return birthdayMonthDay(dob) === localMonthDay(now, timezone)
}

/**
 * Deterministic per-occasion key. Birthdays recur yearly, so the year scopes
 * them. Lapsed nudges (win_back/rebooking_reminder) are scoped to the client's
 * current lastVisitAt: a fresh visit moves lastVisitAt and opens a NEW occasion,
 * while repeated daily crons over the same lapse episode collapse to one send.
 */
export function occasionKey(
  trigger: AutomatedMessageTrigger,
  client: CandidateClient,
  now: Date,
  timezone: string
): string {
  if (trigger === AutomatedMessageTrigger.birthday) {
    return `birthday:${localYear(now, timezone)}`
  }
  // Lapsed nudges. lastVisitAt may be null (never visited) → stable "none" key.
  const stamp = client.lastVisitAt ? client.lastVisitAt.toISOString() : "none"
  return `${trigger}:${stamp}`
}

/** Fetch all active, email-channel automated messages across all tenants. The
 * cron is a trusted system actor; each row carries its own businessId so every
 * send is rendered solely from that row's own joined business + client data. */
async function findActiveMessages(): Promise<ActiveMessage[]> {
  return prisma.automatedMessage.findMany({
    where: { isActive: true },
    select: {
      id: true,
      businessId: true,
      trigger: true,
      channel: true,
      subject: true,
      body: true,
      business: { select: { name: true, timezone: true } },
    },
  }) as unknown as Promise<ActiveMessage[]>
}

/**
 * Candidate clients for a given trigger within one business. The consent +
 * deliverability gate (email present, emailConsent, marketingConsent) is applied
 * in the query for win-back; birthday clients are gated the same way. Tenant-
 * scoped by businessId.
 */
async function findCandidates(
  trigger: AutomatedMessageTrigger,
  businessId: string,
  now: Date
): Promise<CandidateClient[]> {
  const base = {
    businessId,
    deletedAt: null,
    isBlocked: false,
    email: { not: null },
    emailConsent: true,
    marketingConsent: true,
  }

  let where: Record<string, unknown>
  if (trigger === AutomatedMessageTrigger.birthday) {
    where = { ...base, dateOfBirth: { not: null } }
  } else {
    // win_back / rebooking_reminder: lapsed past the inactive window.
    const cutoff = new Date(now.getTime() - INACTIVE_CLIENT_DAYS * DAY_MS)
    where = { ...base, lastVisitAt: { lt: cutoff } }
  }

  return prisma.client.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      lastVisitAt: true,
    },
    orderBy: { createdAt: "asc" },
  }) as unknown as Promise<CandidateClient[]>
}

/**
 * Has this exact (business, client, message, occasion) already been stamped?
 * We look up our own automated-message Notification rows for the client and
 * compare the occasion key stored in metadata. Per-client volume is tiny, so an
 * app-side check is simpler and more portable than a JSON-path query — and it is
 * race-safe for a single daily cron because the stamp is written before sending.
 */
async function alreadySent(
  businessId: string,
  clientId: string,
  messageId: string,
  occasion: string
): Promise<boolean> {
  // Several occasions can accrue over a client's life (e.g. a birthday each
  // year, successive lapse episodes), so scan this client's stamps for an exact
  // (message, occasion) match. Per-client volume is tiny.
  const stamps = await prisma.notification.findMany({
    where: {
      businessId,
      clientId,
      type: AUTOMATED_MESSAGE_NOTIFICATION_TYPE,
    },
    select: { metadata: true },
  })
  return stamps.some((n) => {
    const meta = (n.metadata ?? {}) as Record<string, unknown>
    return meta.automatedMessageId === messageId && meta.occasionKey === occasion
  })
}

/**
 * Process every active daily-evaluable automated message. For each candidate
 * client we render subject/body, stamp a Notification (claim) then email.
 */
export async function runDueAutomatedMessages(
  now: Date = new Date()
): Promise<AutomatedMessageRunResult> {
  const result: AutomatedMessageRunResult = {
    messagesEvaluated: 0,
    skippedCoveredElsewhere: 0,
    skippedNonEmail: 0,
    candidatesScanned: 0,
    emailsSent: 0,
    skippedAlreadySent: 0,
    skippedNoEmailOrConsent: 0,
  }

  const messages = await findActiveMessages()

  for (const msg of messages) {
    // SMS / "both" stays disabled for beta.
    if (msg.channel !== "email") {
      result.skippedNonEmail++
      continue
    }
    // Triggers owned by reminders.ts / lifecycle flows — never fired here.
    if (COVERED_BY_OTHER_FLOWS.includes(msg.trigger)) {
      result.skippedCoveredElsewhere++
      continue
    }
    if (!DAILY_TRIGGERS.includes(msg.trigger)) {
      // Unknown / not-yet-supported trigger: skip rather than guess.
      result.skippedCoveredElsewhere++
      continue
    }

    result.messagesEvaluated++
    const timezone = msg.business.timezone || "UTC"
    const candidates = await findCandidates(msg.trigger, msg.businessId, now)

    for (const client of candidates) {
      result.candidatesScanned++

      // Birthday: only fire on the actual day (the query just narrows to
      // clients WITH a DOB; the day match happens here in business-local time).
      if (
        msg.trigger === AutomatedMessageTrigger.birthday &&
        (!client.dateOfBirth || !isBirthdayToday(client.dateOfBirth, now, timezone))
      ) {
        continue
      }

      if (!client.email) {
        result.skippedNoEmailOrConsent++
        continue
      }

      const occasion = occasionKey(msg.trigger, client, now, timezone)

      // Idempotency: never re-send the same client for the same occasion.
      if (await alreadySent(msg.businessId, client.id, msg.id, occasion)) {
        result.skippedAlreadySent++
        continue
      }

      const vars = {
        firstName: client.firstName,
        lastName: client.lastName,
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        businessName: msg.business.name,
      }
      const subject = renderNotificationTemplate(
        msg.subject?.trim() || `A message from ${msg.business.name}`,
        vars
      )
      const body = renderNotificationTemplate(msg.body, vars)
      const html = marketingEmail({
        subject,
        body,
        businessName: msg.business.name,
      })

      // Claim BEFORE sending: write the stamp first so a provider error can
      // never re-queue this occasion. Mirrors reminders.ts posture.
      await prisma.notification.create({
        data: {
          businessId: msg.businessId,
          clientId: client.id,
          type: AUTOMATED_MESSAGE_NOTIFICATION_TYPE,
          channel: "email",
          recipient: client.email,
          subject,
          body,
          status: "sent",
          sentAt: now,
          metadata: { automatedMessageId: msg.id, occasionKey: occasion, trigger: msg.trigger },
        },
      })

      try {
        const res = await sendEmail({ to: client.email, subject, html })
        if (res?.success) result.emailsSent++
      } catch (e) {
        // Stamp already written; do not roll back (no re-send loop).
        console.error("[automated-messages] sendEmail failed", {
          messageId: msg.id,
          clientId: client.id,
          error: e,
        })
      }

      // Best-effort send-count increment (analytics, not idempotency).
      await prisma.automatedMessage.update({
        where: { id: msg.id, businessId: msg.businessId },
        data: { sendCount: { increment: 1 } },
      })
    }
  }

  return result
}
