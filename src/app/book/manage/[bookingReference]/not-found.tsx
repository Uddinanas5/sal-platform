import Link from "next/link"
import { CalendarX } from "lucide-react"

export default function ManageBookingNotFound() {
  return (
    <div className="min-h-screen env-canvas-lite flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-panel glass-panel-lite rounded-panel p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-mint/15 flex items-center justify-center">
          <CalendarX className="w-8 h-8 text-mint" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink mb-2">
            We couldn&apos;t find your booking
          </h1>
          <p className="text-sm text-ink-soft">
            The booking link may have expired, been cancelled, or contain a typo.
            Please double-check the link in your confirmation email, or contact the
            salon directly for help.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-sal-500 px-6 py-2.5 text-sm font-medium text-white shadow-glow-sm hover:bg-sal-600 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
