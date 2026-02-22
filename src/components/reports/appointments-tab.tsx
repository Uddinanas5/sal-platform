"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChartComponent } from "@/components/charts/bar-chart"
import { PieChartComponent } from "@/components/charts/pie-chart"
import { cn } from "@/lib/utils"

interface AppointmentsTabProps {
  appointmentsByHour: { hour: string; count: number }[]
  appointmentCompletionRate: {
    completed: number
    cancelled: number
    noShow: number
    rescheduled: number
  }
  busiestTimesHeatmap: { day: string; hours: number[] }[]
}

const hourLabels = [
  "8AM", "9AM", "10AM", "11AM", "12PM", "1PM",
  "2PM", "3PM", "4PM", "5PM", "6PM", "7PM",
]

function getHeatmapColor(value: number): string {
  if (value === 0) return "bg-cream-100"
  if (value <= 2) return "bg-sal-100"
  if (value <= 4) return "bg-sal-200"
  if (value <= 6) return "bg-sal-400"
  if (value <= 8) return "bg-sal-600"
  return "bg-sal-800"
}

function getHeatmapTextColor(value: number): string {
  if (value <= 4) return "text-foreground"
  return "text-white"
}

export function AppointmentsTab({
  appointmentsByHour,
  appointmentCompletionRate,
  busiestTimesHeatmap,
}: AppointmentsTabProps) {
  const completionData = [
    { name: "Completed", value: appointmentCompletionRate.completed, color: "#059669" },
    { name: "Cancelled", value: appointmentCompletionRate.cancelled, color: "#ef4444" },
    { name: "No Show", value: appointmentCompletionRate.noShow, color: "#f59e0b" },
    { name: "Rescheduled", value: appointmentCompletionRate.rescheduled, color: "#6366f1" },
  ]

  return (
    <div className="space-y-6">
      {/* Top Row: Bar Chart + Donut */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <BarChartComponent
          data={appointmentsByHour}
          dataKey="count"
          xAxisKey="hour"
          title="Appointments by Hour"
          description="Distribution throughout the day"
          height={300}
          color="#059669"
          className="border-cream-200"
        />
        <PieChartComponent
          data={completionData}
          title="Completion Rate"
          description="Appointment outcomes this month"
          height={300}
          innerRadius={65}
          outerRadius={100}
          showLegend={true}
          formatValue={(v) => `${v}%`}
          className="border-cream-200"
        />
      </motion.div>

      {/* Busiest Times Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-cream-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Busiest Times</CardTitle>
            <CardDescription>Heatmap of appointment density by day and hour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Hour headers */}
                <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 mb-1">
                  <div />
                  {hourLabels.map((hour) => (
                    <div key={hour} className="text-[11px] text-muted-foreground text-center font-medium">
                      {hour}
                    </div>
                  ))}
                </div>

                {/* Heatmap rows */}
                {busiestTimesHeatmap.map((row) => (
                  <div key={row.day} className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 mb-1">
                    <div className="text-sm font-medium text-foreground flex items-center">
                      {row.day}
                    </div>
                    {row.hours.map((value, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "aspect-square rounded-md flex items-center justify-center text-[11px] font-medium transition-colors",
                          getHeatmapColor(value),
                          getHeatmapTextColor(value)
                        )}
                        title={`${row.day} ${hourLabels[idx]}: ${value} appointments`}
                      >
                        {value > 0 ? value : ""}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Legend */}
                <div className="flex items-center gap-2 mt-4 justify-end">
                  <span className="text-xs text-muted-foreground">Less</span>
                  {[0, 2, 4, 6, 8].map((v) => (
                    <div
                      key={v}
                      className={cn("w-5 h-5 rounded-sm", getHeatmapColor(v))}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground">More</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
