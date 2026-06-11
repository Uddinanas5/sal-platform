"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Report uncaught render errors to Sentry (no-op when DSN absent).
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <h2>Something went wrong</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  )
}
