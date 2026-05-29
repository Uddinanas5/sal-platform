"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import Link from "next/link"

export default function BookingSlugError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Public booking error:", error)
  }, [error])

  const unavailable = error.name === "ServiceUnavailableError"

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">
            {unavailable ? "Booking temporarily unavailable" : "Something went wrong"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {unavailable
              ? "We can't reach our booking system right now. Please try again in a few minutes."
              : "An unexpected error occurred while loading this booking page."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg bg-sal-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-sal-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-sal-500 px-6 py-2.5 text-sm font-medium text-sal-600 hover:bg-sal-50 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
