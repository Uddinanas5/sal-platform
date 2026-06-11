import * as Sentry from "@sentry/nextjs"

// Next.js instrumentation hook — loads the right Sentry config per runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// Capture errors thrown in nested React Server Components / route handlers.
export const onRequestError = Sentry.captureRequestError
