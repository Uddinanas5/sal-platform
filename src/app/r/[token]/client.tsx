"use client"

import { useState, useTransition } from "react"
import { Star, Loader2, CheckCircle2, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { submitPublicReview } from "@/lib/actions/reviews"

type Props = {
  token: string
  businessName: string
  clientFirstName: string
  alreadySubmitted: boolean
}

export function ReviewCaptureClient({
  token,
  businessName,
  clientFirstName,
  alreadySubmitted,
}: Props) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(alreadySubmitted)
  const [thankedRating, setThankedRating] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    if (rating < 1) {
      setError("Please choose a star rating")
      return
    }
    startTransition(async () => {
      const result = await submitPublicReview(token, { rating, comment })
      if (!result.success) {
        setError(result.error)
        return
      }
      // Happy clients (4–5) with a configured Google URL get routed there.
      if (result.data.googleReviewUrl) {
        window.location.href = result.data.googleReviewUrl
        return
      }
      setThankedRating(result.data.rating)
      setDone(true)
    })
  }

  const activeStars = hover || rating

  return (
    <main className="min-h-screen bg-[#f9f7f4] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-sm border border-[#f0ece7] overflow-hidden">
        <div className="bg-emerald-600 px-8 py-6 text-center">
          <span className="text-2xl font-bold tracking-wide text-white">SAL</span>
        </div>

        <div className="px-8 py-8">
          {done ? (
            <div className="text-center">
              {thankedRating !== null && thankedRating <= 3 ? (
                <>
                  <Heart className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
                  <h1 className="mt-4 text-xl font-bold text-gray-900">
                    Thank you for the honest feedback
                  </h1>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    We&rsquo;ve shared your comments privately with {businessName} so they can
                    make things right. We appreciate you taking the time.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
                  <h1 className="mt-4 text-xl font-bold text-gray-900">Thank you!</h1>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    Your review helps {businessName} and other clients. We appreciate you.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <h1 className="text-center text-xl font-bold text-gray-900">
                How was your visit, {clientFirstName}?
              </h1>
              <p className="mt-2 text-center text-sm text-gray-600">
                Tap to rate your experience at {businessName}.
              </p>

              <div
                className="mt-6 flex items-center justify-center gap-2"
                role="radiogroup"
                aria-label="Star rating"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    onMouseEnter={() => setHover(value)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(value)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                  >
                    <Star
                      className={cn(
                        "h-9 w-9 transition-colors",
                        value <= activeStars
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300"
                      )}
                    />
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <label htmlFor="review-comment" className="sr-only">
                  Comment
                </label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 2000))}
                  placeholder="Tell us more (optional)…"
                  rows={4}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {error && (
                <p className="mt-3 text-center text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isPending}
                className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Review"
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
