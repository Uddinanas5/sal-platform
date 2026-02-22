import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function ReviewsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Review Summary section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall rating */}
        <Card className="p-6 flex flex-col items-center justify-center">
          <Skeleton className="h-12 w-20 mb-2" />
          <div className="flex gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-5 rounded" />
            ))}
          </div>
          <Skeleton className="h-3 w-28" />
        </Card>

        {/* Rating breakdown */}
        <Card className="p-6">
          <Skeleton className="h-5 w-36 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        </Card>

        {/* Source breakdown */}
        <Card className="p-6">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-9 w-[130px] rounded-lg" />
        </div>
        <Skeleton className="h-9 w-[140px] rounded-lg" />
      </div>

      {/* Count */}
      <Skeleton className="h-4 w-48" />

      {/* Review cards */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Skeleton key={j} className="h-3.5 w-3.5 rounded" />
                      ))}
                    </div>
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3 mb-4" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
