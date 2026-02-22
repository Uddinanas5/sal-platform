"use client"

import * as React from "react"
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AreaChartProps {
  data: Record<string, unknown>[]
  dataKey: string
  xAxisKey: string
  title?: string
  description?: string
  height?: number
  className?: string
  color?: string
  gradientId?: string
  showGrid?: boolean
  formatValue?: (value: number) => string
}

export function AreaChartComponent({
  data,
  dataKey,
  xAxisKey,
  title,
  description,
  height = 300,
  className,
  color = "#059669",
  gradientId = "colorGradient",
  showGrid = true,
  formatValue,
}: AreaChartProps) {
  return (
    <Card className={cn("", className)}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsAreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d5" vertical={false} />}
            <XAxis
              dataKey={xAxisKey}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#888" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#888" }}
              tickFormatter={formatValue}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e0d5",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [formatValue ? formatValue(value) : value, dataKey]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
            />
          </RechartsAreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
