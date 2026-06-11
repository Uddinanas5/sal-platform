"use client"

import * as React from "react"
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_ITEM,
  CHART_TOOLTIP_LABEL,
} from "./chart-theme"

interface PieChartProps {
  data: { name: string; value: number; color?: string }[]
  title?: string
  description?: string
  height?: number
  className?: string
  innerRadius?: number
  outerRadius?: number
  showLegend?: boolean
  formatValue?: (value: number) => string
}

export function PieChartComponent({
  data,
  title,
  description,
  height = 300,
  className,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  formatValue,
}: PieChartProps) {
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
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM}
              labelStyle={CHART_TOOLTIP_LABEL}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [formatValue ? formatValue(value) : value]}
            />
            {showLegend && (
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>}
              />
            )}
          </RechartsPieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
