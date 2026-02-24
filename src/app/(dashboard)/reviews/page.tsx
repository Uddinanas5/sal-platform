import { auth } from "@/lib/auth"
import { getReviews, getReviewStats } from "@/lib/queries/reviews"
import { ReviewsClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ReviewsPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  const [reviews, stats] = await Promise.all([getReviews(undefined, businessId), getReviewStats(businessId)])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ReviewsClient initialReviews={reviews as any} stats={stats} />
}
