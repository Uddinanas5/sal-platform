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
        {/* 4 Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/80 border border-cream-200 rounded-xl p-5 space-y-3"
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white/80 border border-cream-200 rounded-xl p-4 flex items-center gap-4">
          <Skeleton className="h-9 w-64 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>

        {/* 6 Client cards in grid-cols-3 */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/80 border border-cream-200 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
