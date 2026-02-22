import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto w-20 h-20 mb-6">
          <svg viewBox="0 0 100 100" className="w-full h-full opacity-40">
            <defs>
              <linearGradient id="owlGrad404" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#34d399" }} />
                <stop offset="50%" style={{ stopColor: "#059669" }} />
                <stop offset="100%" style={{ stopColor: "#047857" }} />
              </linearGradient>
            </defs>
            <ellipse cx="50" cy="60" rx="30" ry="35" fill="url(#owlGrad404)" />
            <circle cx="50" cy="35" r="25" fill="url(#owlGrad404)" />
            <circle cx="42" cy="35" r="9" fill="white" />
            <circle cx="58" cy="35" r="9" fill="white" />
            <circle cx="42" cy="35" r="6" fill="#022c22" />
            <circle cx="58" cy="35" r="6" fill="#022c22" />
            <circle cx="44" cy="33" r="2.5" fill="white" opacity="0.9" />
            <circle cx="60" cy="33" r="2.5" fill="white" opacity="0.9" />
            <path d="M50 43 Q47 47 50 49 Q53 47 50 43" fill="#047857" />
          </svg>
        </div>
        <h1 className="text-6xl font-heading font-bold text-muted-foreground/50 mb-2">404</h1>
        <h2 className="text-xl font-heading font-semibold text-foreground mb-2">
          Page not found
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-sal-500 px-6 py-2.5 text-sm font-medium text-sal-600 hover:bg-sal-50 transition-colors"
          >
            Go to Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-sal-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-sal-600 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
