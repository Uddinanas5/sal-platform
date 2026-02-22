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
        {/* Alert bar */}
        <div className="bg-white/80 border border-cream-200 rounded-xl p-4 flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-72" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>

        {/* Filter bar */}
        <div className="bg-white/80 border border-cream-200 rounded-xl p-4 flex items-center gap-4">
          <Skeleton className="h-9 w-64 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>

        {/* Table */}
        <div className="bg-white/80 border border-cream-200 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="border-b border-cream-200 px-5 py-3 flex items-center gap-4">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-40 flex-[2]" />
            <Skeleton className="h-4 w-20 flex-1" />
            <Skeleton className="h-4 w-16 flex-1" />
            <Skeleton className="h-4 w-20 flex-1" />
            <Skeleton className="h-4 w-16 flex-1" />
            <Skeleton className="h-4 w-16 flex-1" />
          </div>

          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-cream-200 last:border-b-0 px-5 py-4 flex items-center gap-4"
            >
              <Skeleton className="h-4 w-8" />
              <div className="flex items-center gap-3 flex-[2]">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-16 flex-1" />
              <Skeleton className="h-4 w-12 flex-1" />
              <Skeleton className="h-6 w-20 rounded-full flex-1" />
              <Skeleton className="h-4 w-16 flex-1" />
              <Skeleton className="h-8 w-8 rounded-md flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
