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

const SAL_COLORS = ["#059669", "#34d399", "#047857", "#6ee7b7", "#10b981", "#a7f3d0", "#f97316", "#8b5cf6"]

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
                <Cell key={index} fill={entry.color || SAL_COLORS[index % SAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e0d5",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
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
