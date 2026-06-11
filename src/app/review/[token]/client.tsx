"use client"

import { Star } from "lucide-react"
import type { FormEvent } from "react"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { submitPublicReview } from "@/lib/actions/public-reviews"

type ReviewFormProps = {
  token: string
}

export function ReviewForm({ token }: ReviewFormProps) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await submitPublicReview(token, { overallRating: rating, comment })
      if (result.success) {
        setSubmitted(true)
        setMessage("Thank you. Your review has been submitted.")
      } else {
        setMessage(result.error)
      }
    })
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-sal-100 bg-sal-50 p-5 text-sm text-ink">
        {message}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <p className="mb-3 text-sm font-medium text-ink-soft">Overall rating</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
            >
              <Star
                className={cn(
                  "h-8 w-8",
                  value <= rating ? "fill-amber-400 text-amber-400" : "text-white/25"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="mb-2 block text-sm font-medium text-ink-soft">
          Comment
        </label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Share a few words about your visit..."
        />
      </div>

      {message ? <p className="text-sm text-ink-soft">{message}</p> : null}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Submitting..." : "Submit review"}
      </Button>
    </form>
  )
}
