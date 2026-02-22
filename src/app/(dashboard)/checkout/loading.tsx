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

      <div className="p-6">
        <div className="flex gap-6">
          {/* Left: Product grid (60%) */}
          <div className="w-[60%] space-y-4">
            {/* Search and category filter */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-40 rounded-md" />
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white/80 border border-cream-200 rounded-xl p-4 space-y-3"
                >
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Cart panel (40%) */}
          <div className="w-[40%]">
            <div className="bg-white/80 border border-cream-200 rounded-xl p-5 space-y-4 sticky top-6">
              <Skeleton className="h-6 w-28" />

              {/* Cart items */}
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3 border-b border-cream-200"
                >
                  <Skeleton className="h-14 w-14 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}

              {/* Cart summary */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <div className="border-t border-cream-200 pt-3 flex justify-between">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>

              {/* Checkout button */}
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
