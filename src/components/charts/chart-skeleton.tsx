import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ChartSkeletonProps {
  height?: number
  className?: string
  showTitle?: boolean
}

export function ChartSkeleton({
  height = 300,
  className,
  showTitle = true,
}: ChartSkeletonProps) {
  return (
    <Card className={cn("", className)}>
      {showTitle && (
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32 bg-white/[0.08]" />
          <Skeleton className="h-3.5 w-48 mt-1 bg-white/[0.08]" />
        </CardHeader>
      )}
      <CardContent>
        <Skeleton className="w-full rounded-lg bg-white/[0.08]" style={{ height }} />
      </CardContent>
    </Card>
  )
}
