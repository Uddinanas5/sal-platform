"use client"

import React from "react"
import { motion } from "framer-motion"
import { CalendarDays, DollarSign, Star, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LazyBarChart as BarChartComponent } from "@/components/charts/lazy"
import { LazyPieChart as PieChartComponent } from "@/components/charts/lazy"
import { cn, formatCurrency, formatDate, formatTime, getInitials, getStatusColor } from "@/lib/utils"
import type { Staff, Appointment, Service } from "@/data/mock-data"

interface StaffPerformanceData {
  name: string
  appointments: number
  revenue: number
  rating: number
  commission: number
}

interface StaffPerformanceTabProps {
  staff: Staff
  appointments: Appointment[]
  services: Service[]
  staffPerformance?: StaffPerformanceData | null
}

function buildWeeklyRevenueData(appointments: Appointment[]): { week: string; revenue: number }[] {
  const completed = appointments.filter((a) => a.status === "completed")
  if (completed.length === 0) return []

  // Find the earliest and latest appointment dates
  const dates = completed.map((a) => new Date(a.startTime).getTime())
  const minDate = new Date(Math.min(...dates))
  const maxDate = new Date(Math.max(...dates))

  // Determine week boundaries (Monday-based weeks)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = (day === 0 ? -6 : 1 - day) // Monday = start
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const weekStart = getWeekStart(minDate)
  const weekMap: Map<string, number> = new Map()

  // Collect all week keys in order
  const cursor = new Date(weekStart)
  while (cursor <= maxDate) {
    const key = cursor.toISOString().slice(0, 10) // YYYY-MM-DD of Monday
    weekMap.set(key, 0)
    cursor.setDate(cursor.getDate() + 7)
  }

  // Aggregate revenue per week
  for (const appt of completed) {
    const ws = getWeekStart(new Date(appt.startTime))
    const key = ws.toISOString().slice(0, 10)
    weekMap.set(key, (weekMap.get(key) ?? 0) + (appt.price ?? 0))
  }

  // Format for chart display
  const entries = Array.from(weekMap.entries())
  return entries.map(([isoMonday, revenue], i) => {
    const date = new Date(isoMonday)
    const month = date.toLocaleString("default", { month: "short" })
    const day = date.getDate()
    const label = entries.length <= 8
      ? `${month} ${day}`
      : `Wk ${i + 1}`
    return { week: label, revenue }
  })
}

export function StaffPerformanceTab({ staff, appointments, services, staffPerformance }: StaffPerformanceTabProps) {
  const performance = staffPerformance ?? null

  const completedAppointments = appointments.filter(
    (a) => a.status === "completed"
  )

  const totalRevenue = completedAppointments.reduce(
    (sum, a) => sum + (a.price ?? 0),
    0
  )

  const commissionEarned = totalRevenue * ((staff.commission ?? 35) / 100)

  // Services breakdown for pie chart
  const serviceCountMap: Record<string, number> = {}
  appointments.forEach((a) => {
    if (a.serviceName) {
      serviceCountMap[a.serviceName] = (serviceCountMap[a.serviceName] ?? 0) + 1
    }
  })

  const servicesBreakdown = Object.entries(serviceCountMap).map(
    ([name, value]) => {
      const service = services.find((s) => s.name === name)
      return {
        name,
        value,
        color: service?.color ?? "#6b7280",
      }
    }
  )

  // Weekly revenue derived from real appointments
  const weeklyRevenueData = buildWeeklyRevenueData(appointments)

  // Recent appointments (last 10)
  const recentAppointments = [...appointments]
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 10)

  const stats = [
    {
      label: "Total Appointments",
      value: performance?.appointments ?? appointments.length,
      icon: CalendarDays,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Revenue Generated",
      value: formatCurrency(performance?.revenue ?? totalRevenue),
      icon: DollarSign,
      color: "text-sal-600",
      bg: "bg-sal-100",
    },
    {
      label: "Avg Rating",
      value: performance?.rating != null ? performance.rating : "—",
      icon: Star,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Commission Earned",
      value: formatCurrency(performance?.commission ?? commissionEarned),
      icon: TrendingUp,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        stat.bg
                      )}
                    >
                      <Icon className={cn("w-5 h-5", stat.color)} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-lg font-bold text-foreground">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {weeklyRevenueData.length > 0 ? (
          <BarChartComponent
            data={weeklyRevenueData}
            dataKey="revenue"
            xAxisKey="week"
            title="Weekly Revenue"
            description={`Revenue generated by ${staff.name}`}
            height={250}
            color="#059669"
            formatValue={(v) => `$${v}`}
          />
        ) : (
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center h-[250px] text-center">
              <DollarSign className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">Weekly Revenue</p>
              <p className="text-xs text-muted-foreground mt-1">No completed appointments yet</p>
            </CardContent>
          </Card>
        )}

        {servicesBreakdown.length > 0 ? (
          <PieChartComponent
            data={servicesBreakdown}
            title="Services Breakdown"
            description="Most performed services"
            height={250}
            innerRadius={50}
            outerRadius={85}
          />
        ) : (
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center h-[250px] text-center">
              <TrendingUp className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">Services Breakdown</p>
              <p className="text-xs text-muted-foreground mt-1">No appointments yet</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Appointments */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4">
            Recent Appointments
          </h3>
          <div className="space-y-3">
            {recentAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-3 rounded-lg bg-cream-50 border border-cream-200"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={appointment.clientAvatar} />
                    <AvatarFallback className="text-xs bg-cream-200">
                      {getInitials(appointment.clientName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {appointment.clientName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {appointment.serviceName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {formatCurrency(appointment.price)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(appointment.startTime)}{" "}
                    {formatTime(appointment.startTime)}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs capitalize ml-2",
                    getStatusColor(appointment.status)
                  )}
                >
                  {appointment.status}
                </Badge>
              </div>
            ))}
            {recentAppointments.length === 0 && (
              <p className="text-sm text-muted-foreground/70 text-center py-4">
                No appointments found for this staff member
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
