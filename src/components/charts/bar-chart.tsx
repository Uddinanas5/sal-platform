"use client"

import * as React from "react"
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_ITEM,
  CHART_TOOLTIP_LABEL,
} from "./chart-theme"

interface BarChartProps {
  data: Record<string, unknown>[]
  dataKey: string
  xAxisKey: string
  title?: string
  description?: string
  height?: number
  className?: string
  color?: string
  colors?: string[]
  layout?: "horizontal" | "vertical"
  showGrid?: boolean
  formatValue?: (value: number) => string
}

export function BarChartComponent({
  data,
  dataKey,
  xAxisKey,
  title,
  description,
  height = 300,
  className,
  color,
  colors,
  layout = "horizontal",
  showGrid = true,
  formatValue,
}: BarChartProps) {
  const barColors = colors || (color ? [color] : CHART_COLORS)

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
          <RechartsBarChart
            data={data}
            layout={layout === "vertical" ? "vertical" : "horizontal"}
            margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={layout !== "vertical"} horizontal={layout === "vertical" || true} />}
            {layout === "vertical" ? (
              <>
                <XAxis type="number" axisLine={false} tickLine={false} tick={CHART_TICK} tickFormatter={formatValue} />
                <YAxis type="category" dataKey={xAxisKey} axisLine={false} tickLine={false} tick={CHART_TICK} width={100} />
              </>
            ) : (
              <>
                <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={CHART_TICK} />
                <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} tickFormatter={formatValue} />
              </>
            )}
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
              contentStyle={CHART_TOOLTIP_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM}
              labelStyle={CHART_TOOLTIP_LABEL}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [formatValue ? formatValue(value) : value, dataKey]}
            />
            <Bar dataKey={dataKey} radius={[7, 7, 0, 0]} maxBarSize={50}>
              {data.map((_, index) => (
                <Cell key={index} fill={barColors[index % barColors.length]} />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
