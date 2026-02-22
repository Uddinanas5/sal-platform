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
        {/* 4 Stat cards in a row */}
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

        {/* Chart area: 2/3 + 1/3 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white/80 border border-cream-200 rounded-xl p-5 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </div>
          <div className="col-span-1 bg-white/80 border border-cream-200 rounded-xl p-5 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </div>
        </div>

        {/* Schedule area: 2/3 + sidebar 1/3 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white/80 border border-cream-200 rounded-xl p-5 space-y-4">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
          <div className="col-span-1 bg-white/80 border border-cream-200 rounded-xl p-5 space-y-4">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
