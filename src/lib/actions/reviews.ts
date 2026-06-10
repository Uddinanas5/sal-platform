"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireMinRole } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { reviewRequestEmail } from "@/lib/email-templates"
import { signReviewToken, verifyReviewToken } from "@/lib/review-token"
import { rateLimit } from "@/lib/rate-limit"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const respondToReviewSchema = z.object({
  reviewId: z.string().uuid(),
  response: z.string().min(1, "Response cannot be empty"),
})

export async function respondToReview(
  reviewId: string,
  response: string
): Promise<ActionResult> {
  try {
    const parsed = respondToReviewSchema.parse({ reviewId, response })

    const { businessId } = await requireMinRole("admin")

    await prisma.review.update({
      where: { id: parsed.reviewId, businessId },
      data: {
        response: parsed.response,
        respondedAt: new Date(),
      },
    })

    revalidatePath("/reviews")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("respondToReview error:", e)
    return { success: false, error: (e as Error).message }
  }
}

// ============================================================================
// REVIEW COLLECTION LOOP
// ----------------------------------------------------------------------------
// (1) sendReviewRequest — staff-triggered post-visit email carrying a signed,
//     stateless token over {appointmentId, clientId}. No new DB field.
// (2) submitPublicReview — the PUBLIC capture handler. It trusts ONLY the
//     validated token: business/staff/appointment/client are all derived from
//     the token + a fresh tenant-scoped DB read, never from request input. A
//     client-supplied businessId/staffId is ignored. 1–3 stars stay private;
//     4–5 stars are routed (by the page) toward an external Google review URL.
// ============================================================================

const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/**
 * Generate a signed review link for a COMPLETED appointment and email it to the
 * client. Staff-only (admin). Everything is scoped to the caller's businessId,
 * which is derived from the session — never from input.
 */
export async function sendReviewRequest(appointmentId: string): Promise<ActionResult> {
  try {
    const id = z.string().uuid().parse(appointmentId)
    const { businessId } = await requireMinRole("admin")

    // Tenant-scoped load. The appointment MUST belong to the caller's business
    // and have a client to send to. We derive the token's client from THIS row.
    const appointment = await prisma.appointment.findFirst({
      where: { id, businessId },
      select: {
        id: true,
        status: true,
        clientId: true,
        client: { select: { id: true, email: true, firstName: true, emailConsent: true } },
        business: { select: { name: true } },
        services: {
          select: {
            name: true,
            staff: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
      },
    })

    if (!appointment) {
      return { success: false, error: "Appointment not found" }
    }
    if (appointment.status !== "completed") {
      return { success: false, error: "Review requests can only be sent for completed visits" }
    }
    if (!appointment.clientId || !appointment.client) {
      return { success: false, error: "This appointment has no client to send a review request to" }
    }
    if (!appointment.client.email) {
      return { success: false, error: "This client has no email on file" }
    }
    if (appointment.client.emailConsent === false) {
      return { success: false, error: "This client has opted out of emails" }
    }

    const token = signReviewToken(appointment.id, appointment.clientId)
    const reviewUrl = `${appUrl()}/r/${token}`

    const lead = appointment.services[0]
    const staffUser = lead?.staff?.user
    const staffName = staffUser ? `${staffUser.firstName} ${staffUser.lastName}` : undefined

    // Capture the send result — sendEmail never throws; it returns
    // {success:false} when Resend is unconfigured or the provider rejects. If we
    // ignored it, the UI would claim "We emailed the client" even when nothing
    // was sent. Fail honestly so the button stops lying.
    const emailRes = await sendEmail({
      to: appointment.client.email,
      subject: `How was your visit to ${appointment.business.name}?`,
      html: reviewRequestEmail({
        clientName: appointment.client.firstName,
        businessName: appointment.business.name,
        staffName,
        serviceName: lead?.name,
        reviewUrl,
      }),
    })

    if (!emailRes.success) {
      return { success: false, error: "Could not send the review request right now. Please try again." }
    }

    revalidatePath("/reviews")
    revalidatePath("/calendar")
    return { success: true, data: undefined }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("sendReviewRequest error:", e)
    return { success: false, error: (e as Error).message }
  }
}

const submitPublicReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
})

export type SubmitPublicReviewResult = ActionResult<{
  rating: number
  /** When 4–5 stars and the business configured one, the page redirects here. */
  googleReviewUrl: string | null
}>

/**
 * PUBLIC review submit. No session. The token is the ONLY source of truth for
 * which business/appointment/client this review belongs to. A tampered or
 * invalid token is rejected; any businessId/staffId in the request body is
 * ignored (the schema doesn't even read it).
 */
export async function submitPublicReview(
  token: string,
  input: { rating: number | string; comment?: string }
): Promise<SubmitPublicReviewResult> {
  try {
    const { rating, comment } = submitPublicReviewSchema.parse(input)

    // 1) Verify the signed token. Tampered/garbage => null => reject.
    const decoded = verifyReviewToken(token)
    if (!decoded) {
      return { success: false, error: "This review link is invalid or has expired" }
    }

    // Light abuse guard: cap submissions per token.
    const rl = await rateLimit(`review-submit:${token}`, 5, 60 * 60 * 1000)
    if (rl.limited) {
      return { success: false, error: "Too many attempts. Please try again later." }
    }

    // 2) Re-validate the (appointment, client) pairing against the DB. The
    //    businessId/locationId/staffId all come from THIS trusted row — never
    //    from the caller. We scope by appointmentId + clientId so a token whose
    //    pairing no longer holds (e.g. appointment reassigned) is rejected.
    const appointment = await prisma.appointment.findFirst({
      where: { id: decoded.appointmentId, clientId: decoded.clientId },
      select: {
        id: true,
        businessId: true,
        locationId: true,
        clientId: true,
        services: {
          select: { staffId: true },
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
        business: { select: { settings: true } },
      },
    })

    if (!appointment || !appointment.clientId) {
      return { success: false, error: "This review link is invalid or has expired" }
    }

    // One review per appointment: don't let a forwarded link spam duplicates.
    const existing = await prisma.review.findFirst({
      where: { appointmentId: appointment.id },
      select: { id: true },
    })
    if (existing) {
      return { success: false, error: "A review has already been submitted for this visit" }
    }

    const staffId = appointment.services[0]?.staffId ?? null
    // 1–3 stars are kept private (internal feedback); 4–5 are public.
    const isPublic = rating >= 4

    await prisma.review.create({
      data: {
        // businessId/locationId derive from the trusted appointment row.
        businessId: appointment.businessId,
        locationId: appointment.locationId,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        staffId,
        overallRating: rating,
        comment: comment && comment.length > 0 ? comment : null,
        isPublic,
        isVerified: true, // came from a signed, appointment-bound link
      },
    })

    // 3) Route happy clients (4–5) toward the business's external Google review
    //    URL when configured in Business.settings JSON (no migration). 1–3 stars
    //    stay private and are never routed externally.
    let googleReviewUrl: string | null = null
    if (isPublic) {
      const settings = (appointment.business.settings ?? {}) as Record<string, unknown>
      const raw = settings.googleReviewUrl
      if (typeof raw === "string" && /^https?:\/\//i.test(raw.trim())) {
        googleReviewUrl = raw.trim()
      }
    }

    revalidatePath("/reviews")
    return { success: true, data: { rating, googleReviewUrl } }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    console.error("submitPublicReview error:", e)
    return { success: false, error: "Something went wrong submitting your review" }
  }
}
