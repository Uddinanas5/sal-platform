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

const SAL_COLORS = ["#059669", "#34d399", "#047857", "#6ee7b7", "#10b981", "#a7f3d0"]

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
  const barColors = colors || (color ? [color] : SAL_COLORS)

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
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d5" vertical={layout !== "vertical"} horizontal={layout === "vertical" || true} />}
            {layout === "vertical" ? (
              <>
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#888" }} tickFormatter={formatValue} />
                <YAxis type="category" dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#888" }} width={100} />
              </>
            ) : (
              <>
                <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#888" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#888" }} tickFormatter={formatValue} />
              </>
            )}
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
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={50}>
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
