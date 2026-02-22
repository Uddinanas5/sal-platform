import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function MarketingLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-60" />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-t-lg" />
        ))}
      </div>

      {/* Campaign cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-3/4 mb-4" />
            <div className="flex items-center gap-4 mb-4">
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-5 w-14" />
              </div>
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </Card>
        ))}
      </div>
    </div>
  )
}
