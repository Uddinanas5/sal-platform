"use server"

import { prisma } from "@/lib/prisma"
import { getBusinessContext } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

export async function respondToReview(
  reviewId: string,
  response: string
): Promise<ActionResult> {
  try {
    if (!response.trim()) return { success: false, error: "Response cannot be empty" }

    const { businessId } = await getBusinessContext()

    await prisma.review.update({
      where: { id: reviewId, businessId },
      data: {
        response,
        respondedAt: new Date(),
      },
    })

    revalidatePath("/reviews")
    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
