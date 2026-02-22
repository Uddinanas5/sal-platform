"use client"

import * as React from "react"
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface LineChartProps {
  data: Record<string, unknown>[]
  lines: { dataKey: string; color: string; name?: string }[]
  xAxisKey: string
  title?: string
  description?: string
  height?: number
  className?: string
  showGrid?: boolean
  showLegend?: boolean
  formatValue?: (value: number) => string
}

export function LineChartComponent({
  data,
  lines,
  xAxisKey,
  title,
  description,
  height = 300,
  className,
  showGrid = true,
  showLegend = false,
  formatValue,
}: LineChartProps) {
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
          <RechartsLineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
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
            />
            {showLegend && <Legend />}
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                name={line.name || line.dataKey}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
