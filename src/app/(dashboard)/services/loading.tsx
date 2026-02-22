import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function ServicesLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-lg" />
        ))}
      </div>

      {/* Service card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-6 rounded" />
            </div>
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-3/4 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-5 w-14" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
