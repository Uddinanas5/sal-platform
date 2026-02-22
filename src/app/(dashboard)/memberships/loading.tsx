import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function MembershipsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-14" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <Skeleton className="h-10 w-32 rounded-t-lg" />
        <Skeleton className="h-10 w-28 rounded-t-lg" />
      </div>

      {/* Membership plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            <Skeleton className="h-6 w-36 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3 mb-4" />
            <div className="flex items-end gap-1 mb-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="space-y-2 mb-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-10" />
            </div>
          </Card>
        ))}
      </div>

      {/* Members table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4 p-4 border-b bg-cream-50">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 p-4 border-b last:border-b-0 items-center">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  )
}
