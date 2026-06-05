"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { verifyReviewToken } from "@/lib/reviews/review-token"

const reviewSchema = z.object({
  overallRating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
})

export async function submitPublicReview(
  token: string,
  input: z.infer<typeof reviewSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const payload = verifyReviewToken(token)
  if (!payload) return { success: false, error: "This review link is invalid or expired." }

  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid review." }
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: payload.appointmentId },
    include: {
      reviews: { select: { id: true }, take: 1 },
      services: { select: { staffId: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  })

  if (!appointment || !appointment.clientId) {
    return { success: false, error: "We could not find this appointment." }
  }
  if (appointment.status !== "completed") {
    return { success: false, error: "Reviews can be submitted after the appointment is completed." }
  }
  if (appointment.reviews.length > 0) {
    return { success: false, error: "A review has already been submitted for this appointment." }
  }

  await prisma.review.create({
    data: {
      businessId: appointment.businessId,
      locationId: appointment.locationId,
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      staffId: appointment.services[0]?.staffId,
      overallRating: parsed.data.overallRating,
      serviceRating: parsed.data.overallRating,
      staffRating: parsed.data.overallRating,
      comment: parsed.data.comment || null,
      isPublic: true,
      isVerified: true,
    },
  })

  revalidatePath(`/review/${token}`)
  revalidatePath("/reviews")
  return { success: true }
}
