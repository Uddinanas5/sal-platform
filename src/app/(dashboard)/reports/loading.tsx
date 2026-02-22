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
        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-white/80 border border-cream-200 rounded-xl p-1.5 w-fit">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg" />
          ))}
        </div>

        {/* 2 Charts side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/80 border border-cream-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <Skeleton className="h-[260px] w-full rounded-lg" />
          </div>
          <div className="bg-white/80 border border-cream-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <Skeleton className="h-[260px] w-full rounded-lg" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white/80 border border-cream-200 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="border-b border-cream-200 px-5 py-3 flex items-center gap-4">
            <Skeleton className="h-4 w-32 flex-[2]" />
            <Skeleton className="h-4 w-20 flex-1" />
            <Skeleton className="h-4 w-20 flex-1" />
            <Skeleton className="h-4 w-20 flex-1" />
            <Skeleton className="h-4 w-20 flex-1" />
          </div>

          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-cream-200 last:border-b-0 px-5 py-4 flex items-center gap-4"
            >
              <Skeleton className="h-4 w-40 flex-[2]" />
              <Skeleton className="h-4 w-16 flex-1" />
              <Skeleton className="h-4 w-16 flex-1" />
              <Skeleton className="h-4 w-16 flex-1" />
              <Skeleton className="h-6 w-20 rounded-full flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
