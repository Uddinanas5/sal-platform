import Link from "next/link"
import { Search } from "lucide-react"

export default function BookingNotFound() {
  return (
    <div className="min-h-screen env-canvas-lite flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-panel glass-panel-lite rounded-panel p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-mint/15 flex items-center justify-center">
          <Search className="w-8 h-8 text-mint" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink mb-2">
            Salon not found
          </h1>
          <p className="text-sm text-ink-soft">
            We couldn&apos;t find a salon at this link. Double-check the URL with the
            business, or head home to search for one.
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
