"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import Link from "next/link"

export default function ManageBookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Manage booking error:", error)
  }, [error])

  const unavailable = error.name === "ServiceUnavailableError"

  return (
    <div className="min-h-screen env-canvas-lite flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-panel glass-panel-lite rounded-panel p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-400/15 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-heading font-bold text-ink mb-2">
            {unavailable ? "Booking system temporarily unavailable" : "Something went wrong"}
          </h2>
          <p className="text-sm text-ink-soft">
            {unavailable
              ? "We can't reach our booking system right now. Please try again in a few minutes — your appointment is still on the books."
              : "An unexpected error occurred while loading your booking."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-sal-500 px-6 py-2.5 text-sm font-medium text-white shadow-glow-sm hover:bg-sal-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/25 bg-white/5 px-6 py-2.5 text-sm font-medium text-ink hover:bg-white/10 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
