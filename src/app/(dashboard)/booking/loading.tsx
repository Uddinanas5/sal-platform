import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function BookingLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Two-column layout: Settings + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Settings cards */}
        <div className="space-y-6">
          {/* Booking Settings card */}
          <Card className="p-6">
            <Skeleton className="h-5 w-36 mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
              ))}
            </div>
          </Card>

          {/* Widget Code card */}
          <Card className="p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg mt-4" />
          </Card>

          {/* QR Code card */}
          <Card className="p-6">
            <Skeleton className="h-5 w-28 mb-4" />
            <div className="flex items-center gap-6">
              <Skeleton className="h-32 w-32 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
                <Skeleton className="h-9 w-32 rounded-lg mt-2" />
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Phone preview */}
        <div className="flex flex-col items-center">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-[600px] w-[300px] rounded-[2.5rem]" />
        </div>
      </div>
    </div>
  )
}
