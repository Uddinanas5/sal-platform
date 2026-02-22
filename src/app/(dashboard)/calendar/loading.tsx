import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header skeleton */}
      <div className="h-16 bg-white/80 border-b border-cream-200 px-6 flex items-center">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Calendar header bar */}
        <div className="bg-white/80 border border-cream-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-white/80 border border-cream-200 rounded-xl p-4 space-y-2">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>

          {/* Calendar rows (5 weeks) */}
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, col) => (
                <div
                  key={col}
                  className="h-24 border border-cream-200 rounded-md p-2 space-y-1"
                >
                  <Skeleton className="h-4 w-6" />
                  {row % 2 === 0 && col % 3 === 0 && (
                    <Skeleton className="h-5 w-full rounded-sm" />
                  )}
                  {row % 3 === 1 && col % 2 === 0 && (
                    <Skeleton className="h-5 w-full rounded-sm" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
