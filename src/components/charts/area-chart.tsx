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
import {
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_ITEM,
  CHART_TOOLTIP_LABEL,
} from "./chart-theme"

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
  color = "#4fe6a6",
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
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />}
            <XAxis
              dataKey={xAxisKey}
              axisLine={false}
              tickLine={false}
              tick={CHART_TICK}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={CHART_TICK}
              tickFormatter={formatValue}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
              contentStyle={CHART_TOOLTIP_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM}
              labelStyle={CHART_TOOLTIP_LABEL}
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
