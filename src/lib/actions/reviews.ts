"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getBusinessContext } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"

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

    const { businessId } = await getBusinessContext()

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
