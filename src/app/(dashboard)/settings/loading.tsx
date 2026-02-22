import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Tabs bar */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-t-lg flex-shrink-0" />
        ))}
      </div>

      {/* Settings cards */}
      <div className="max-w-4xl space-y-6">
        {/* Business Profile card */}
        <Card className="p-6">
          <div className="space-y-2 mb-6">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex items-center gap-6 mb-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-px w-full mb-6" />
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </Card>

        {/* Localization card */}
        <Card className="p-6">
          <div className="space-y-2 mb-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </Card>

        {/* Appearance card */}
        <Card className="p-6">
          <div className="space-y-2 mb-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex items-center justify-between py-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-20 rounded-lg" />
              ))}
            </div>
          </div>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
