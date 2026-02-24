import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Breadcrumb */}
      <div className="h-12 bg-card/80 backdrop-blur-sm border-b border-cream-200 px-6 flex items-center">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Staff Header Card with banner, avatar, info, buttons */}
        <div className="bg-card rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
          {/* Color banner */}
          <Skeleton className="h-28 w-full rounded-none" />

          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start gap-4 -mt-12">
              {/* Avatar */}
              <Skeleton className="w-24 h-24 rounded-full ring-4 ring-white" />

              <div className="flex-1 pt-2 sm:pt-14 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-7 w-40" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-20 rounded-md" />
                    <Skeleton className="h-9 w-36 rounded-md" />
                    <Skeleton className="h-9 w-32 rounded-md" />
                  </div>
                </div>

                {/* Service tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-20 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="space-y-6">
          <div className="grid w-full grid-cols-4 max-w-lg bg-muted rounded-lg p-1">
            {["Performance", "Schedule", "Commission", "Time Off"].map((tab) => (
              <Skeleton key={tab} className="h-8 rounded-md" />
            ))}
          </div>

          {/* Tab content placeholder */}
          <div className="bg-card border border-cream-200 rounded-xl p-6 space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-cream-50 rounded-lg p-4 space-y-2"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
