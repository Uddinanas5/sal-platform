"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again or return to the dashboard.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
            <Home className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
}
