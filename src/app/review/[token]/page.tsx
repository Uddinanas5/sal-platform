import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { verifyReviewToken } from "@/lib/reviews/review-token"
import { ReviewForm } from "./client"

export default async function ReviewPage({ params }: { params: { token: string } }) {
  const payload = verifyReviewToken(params.token)
  if (!payload) notFound()

  const appointment = await prisma.appointment.findUnique({
    where: { id: payload.appointmentId },
    include: {
      business: { select: { name: true } },
      client: { select: { firstName: true } },
      reviews: { select: { id: true }, take: 1 },
      services: { select: { name: true }, orderBy: { sortOrder: "asc" }, take: 3 },
    },
  })

  if (!appointment || !appointment.clientId) notFound()

  const serviceName =
    appointment.services.map((service: { name: string }) => service.name).join(", ") ||
    "your service"
  const alreadyReviewed = appointment.reviews.length > 0

  return (
    <main className="min-h-screen bg-cream-50 px-4 py-10 text-stone-950">
      <div className="mx-auto w-full max-w-xl rounded-lg border border-cream-200 bg-card p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-mint">
            {appointment.business.name}
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold">How was your visit?</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {appointment.client?.firstName ? `Hi ${appointment.client.firstName}, ` : ""}
            thank you for booking {serviceName}. Your feedback helps the team improve.
          </p>
        </div>

        {alreadyReviewed ? (
          <div className="rounded-lg border border-sal-100 bg-sal-50 p-5 text-sm text-ink">
            A review has already been submitted for this appointment. Thank you.
          </div>
        ) : appointment.status === "completed" ? (
          <ReviewForm token={params.token} />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            This review link will be available after the appointment is completed.
          </div>
        )}
      </div>
    </main>
  )
}
