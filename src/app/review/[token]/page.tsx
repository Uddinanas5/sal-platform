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
    <main className="min-h-screen env-canvas-lite px-4 py-10">
      <div className="mx-auto w-full max-w-xl glass-panel glass-panel-lite rounded-panel p-6">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-mint">
            {appointment.business.name}
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold text-ink">How was your visit?</h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
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
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/15 p-5 text-sm text-amber-200">
            This review link will be available after the appointment is completed.
          </div>
        )}
      </div>
    </main>
  )
}
