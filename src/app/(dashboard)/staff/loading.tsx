import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function StaffLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-12" />
          </Card>
        ))}
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Skeleton className="h-10 flex-1 max-w-md rounded-lg" />
          <Skeleton className="h-10 w-[150px] rounded-lg" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      {/* Staff card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            {/* Color header band */}
            <Skeleton className="h-20 w-full rounded-none" />

            <div className="pt-10 p-5">
              {/* Avatar overlapping header */}
              <div className="flex items-start justify-between mb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>

              {/* Contact info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>

              {/* Services */}
              <div className="mb-4">
                <Skeleton className="h-3 w-14 mb-2" />
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-5 w-20 rounded-full" />
                  ))}
                </div>
              </div>

              {/* Working days */}
              <div>
                <Skeleton className="h-3 w-20 mb-2" />
                <div className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <Skeleton key={j} className="h-8 w-8 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Schedule overview table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-8 gap-4 p-4 border-b bg-cream-50">
            <Skeleton className="h-4 w-12" />
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-8 mx-auto" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-8 gap-4 p-4 border-b last:border-b-0 items-center">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-3 w-16 mx-auto" />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
