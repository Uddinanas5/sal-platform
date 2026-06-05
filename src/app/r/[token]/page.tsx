import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { verifyReviewToken } from "@/lib/review-token"
import { ReviewCaptureClient } from "./client"

// Public, no-auth review capture page. The [token] is a signed HMAC over
// {appointmentId, clientId}. We validate the signature here, then load ONLY the
// minimal display data (business name, first name) scoped to the token's
// appointment — never to anything in the request. All write authority lives in
// the submitPublicReview server action, which re-derives business/staff from the
// token. This page is purely a guarded entry point + form host.
export const dynamic = "force-dynamic"

export default async function PublicReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const decoded = verifyReviewToken(token)
  if (!decoded) {
    // Tampered / malformed / wrong-signature link.
    notFound()
  }

  // Display-only lookup, scoped to the token's verified pairing. Returns null if
  // the appointment/client pairing no longer holds — treated as a dead link.
  let appointment
  try {
    appointment = await prisma.appointment.findFirst({
      where: { id: decoded.appointmentId, clientId: decoded.clientId },
      select: {
        id: true,
        client: { select: { firstName: true } },
        business: { select: { name: true } },
        reviews: { select: { id: true }, take: 1 },
      },
    })
  } catch {
    // Infra error (DB unreachable) — let the route error boundary handle it.
    throw new Error("Database unreachable")
  }

  if (!appointment) {
    notFound()
  }

  const alreadySubmitted = appointment.reviews.length > 0

  return (
    <ReviewCaptureClient
      token={token}
      businessName={appointment.business.name}
      clientFirstName={appointment.client?.firstName ?? "there"}
      alreadySubmitted={alreadySubmitted}
    />
  )
}
