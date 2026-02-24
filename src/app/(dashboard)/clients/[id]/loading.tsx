import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Breadcrumb */}
      <div className="h-12 bg-card/80 backdrop-blur-sm border-b border-cream-200 px-6 flex items-center">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Header Card with avatar, name, contact, and action buttons */}
        <div className="bg-card border border-cream-200 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-20 rounded-md" />
              <Skeleton className="h-9 w-32 rounded-md" />
              <Skeleton className="h-9 w-40 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>
        </div>

        {/* Stats Row - 5 stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-cream-200 rounded-xl p-4 flex items-center gap-3"
            >
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-14" />
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="space-y-6">
          <div className="bg-card border border-cream-200 rounded-lg p-1 flex items-center gap-1 w-fit">
            {["Overview", "Appointments", "Purchases", "Notes & Files", "Loyalty"].map((tab) => (
              <Skeleton key={tab} className="h-8 w-24 rounded-md" />
            ))}
          </div>

          {/* Tab content placeholder */}
          <div className="bg-card border border-cream-200 rounded-xl p-6 space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
