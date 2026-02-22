"use client"

import * as React from "react"
import { BarChart3 } from "lucide-react"
import { ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ChartContainerProps {
  title?: string
  description?: string
  children: React.ReactNode
  height?: number
  className?: string
  action?: React.ReactNode
  isEmpty?: boolean
  emptyMessage?: string
}

export function ChartContainer({
  title,
  description,
  children,
  height = 300,
  className,
  action,
  isEmpty,
  emptyMessage = "No data available for this period",
}: ChartContainerProps) {
  return (
    <Card className={cn("", className)}>
      {(title || action) && (
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </CardHeader>
      )}
      <CardContent>
        {isEmpty ? (
          <div
            className="flex flex-col items-center justify-center text-muted-foreground/50"
            style={{ height }}
          >
            <BarChart3 className="h-10 w-10 mb-2" />
            <p className="text-sm font-medium">{emptyMessage}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
