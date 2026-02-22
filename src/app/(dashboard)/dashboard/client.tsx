"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { isSameDay } from "date-fns"
import {
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  Star,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { StatsCard } from "@/components/dashboard/stats-card"
import { AppointmentCard } from "@/components/dashboard/appointment-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AreaChartComponent } from "@/components/charts/area-chart"
import { PieChartComponent } from "@/components/charts/pie-chart"
import { BarChartComponent } from "@/components/charts/bar-chart"
import { formatCurrency } from "@/lib/utils"
import type { Appointment } from "@/data/mock-data"

interface DashboardClientProps {
  appointments: Appointment[]
  clients: Array<{
    id: string; name: string; email: string; phone: string; avatar?: string;
    totalVisits: number; totalSpent: number; lastVisit?: Date; tags?: string[];
  }>
  stats: {
    todayRevenue: number; todayAppointments: number;
    completedAppointments: number; upcomingAppointments: number;
    totalClients: number; newClientsThisMonth: number; averageRating: number;
  }
  revenueData: Array<{ day: string; revenue: number; appointments: number }>
  channelData: Array<{ name: string; value: number; color: string }>
  staffData: Array<{ name: string; appointments: number; revenue: number; rating: number }>
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function DashboardClient(props: DashboardClientProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(" ")[0] || "there"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => new Date(), [])
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(today)

  const recentClients = useMemo(() =>
    [...props.clients]
      .sort((a, b) => (b.lastVisit ? new Date(b.lastVisit).getTime() : 0) - (a.lastVisit ? new Date(a.lastVisit).getTime() : 0))
      .slice(0, 5),
  [props.clients])

  // Filter and sort today's appointments
  const todayAppointments = useMemo(() => {
    return props.appointments
      .filter((a) => isSameDay(new Date(a.startTime), today))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [props.appointments, today])

  return (
    <div className="min-h-screen bg-cream">
      <Header title="Dashboard" subtitle={formattedDate} />

      <div className="p-6 space-y-6">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sal-500 via-sal-600 to-sal-800 p-6 text-white"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium text-sal-200">AI Insight</span>
            </div>
            <h2 className="text-2xl font-heading font-bold mb-2">{getGreeting()}, {firstName}!</h2>
            <p className="text-sal-100 max-w-xl">
              You have <span className="font-semibold text-white">{props.stats.todayAppointments} appointments</span> today.
              Based on your booking trends, consider opening more slots on Thursdays –
              they&apos;re 23% busier than average!
            </p>

            {/* Daily Revenue Progress */}
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-sal-200">Today&apos;s Revenue</span>
                <span className="font-semibold text-white">
                  {formatCurrency(props.stats.todayRevenue)} / {formatCurrency(1200)} target
                </span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((props.stats.todayRevenue / 1200) * 100, 100)}%` }}
                  transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                  className="h-full bg-white/80 rounded-full"
                />
              </div>
              <p className="text-xs text-sal-200 mt-1">
                {Math.round((props.stats.todayRevenue / 1200) * 100)}% of daily target
              </p>
            </div>

            <Button
              variant="secondary"
              className="mt-4 bg-white/20 hover:bg-white/30 text-white border-white/20"
              onClick={() => router.push("/reports")}
            >
              View Insights
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 right-20 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-sal-400/20 rounded-full" />
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Today's Revenue"
            value={formatCurrency(props.stats.todayRevenue)}
            change={12.5}
            changeLabel="vs yesterday"
            icon={DollarSign}
            iconColor="text-sal-600"
            iconBgColor="bg-sal-100"
            delay={0}
            href="/reports"
            sparklineData={props.revenueData.map((d) => d.revenue)}
            sparklineColor="#059669"
          />
          <StatsCard
            title="Today's Appointments"
            value={props.stats.todayAppointments}
            icon={Calendar}
            iconColor="text-sal-600"
            iconBgColor="bg-sal-100"
            delay={0.1}
            href="/calendar"
            sparklineData={props.revenueData.map((d) => d.appointments)}
            sparklineColor="#3b82f6"
          />
          <StatsCard
            title="Total Clients"
            value={props.stats.totalClients}
            change={props.stats.newClientsThisMonth}
            changeLabel="new this month"
            icon={Users}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
            delay={0.2}
            href="/clients"
          />
          <StatsCard
            title="Average Rating"
            value={props.stats.averageRating}
            icon={Star}
            iconColor="text-amber-600"
            iconBgColor="bg-amber-100"
            delay={0.3}
            href="/reviews"
          />
        </div>

        {/* Charts Row: Revenue + Channel Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <AreaChartComponent
            data={props.revenueData}
            dataKey="revenue"
            xAxisKey="day"
            title="Revenue (Last 7 Days)"
            description="Daily revenue overview"
            height={280}
            color="#059669"
            gradientId="dashboardRevenueGradient"
            formatValue={(v) => formatCurrency(v)}
            className="lg:col-span-2 border-cream-200"
          />
          <PieChartComponent
            data={props.channelData}
            title="Booking Channels"
            description="How clients book"
            height={280}
            innerRadius={50}
            outerRadius={90}
            showLegend={true}
            formatValue={(v) => `${v}%`}
            className="border-cream-200"
          />
        </motion.div>

        {/* Staff Performance Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <BarChartComponent
            data={props.staffData}
            dataKey="revenue"
            xAxisKey="name"
            title="Staff Performance"
            description="Revenue by team member this month"
            height={280}
            layout="vertical"
            formatValue={(v) => formatCurrency(v)}
            className="border-cream-200"
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <Card className="lg:col-span-2 border-cream-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-heading">Today&apos;s Schedule</CardTitle>
                    <Badge variant="default" className="text-xs tabular-nums">
                      {todayAppointments.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {props.stats.completedAppointments} completed, {props.stats.upcomingAppointments} upcoming
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push("/calendar")}>
                View Calendar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {todayAppointments.length > 0 ? (
                    todayAppointments.map((appointment, index) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        variant="compact"
                        index={index}
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Calendar className="w-10 h-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No appointments today</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Your schedule is clear</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Sidebar Content */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="border-cream-200">
              <CardHeader>
                <CardTitle className="text-lg font-heading">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1 border-cream-200 hover:bg-sal-50 hover:border-sal-200"
                  onClick={() => router.push("/calendar")}
                >
                  <Calendar className="w-5 h-5 text-sal-500" />
                  <span className="text-xs">New Booking</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1 border-cream-200 hover:bg-sal-50 hover:border-sal-200"
                  onClick={() => router.push("/clients")}
                >
                  <Users className="w-5 h-5 text-sal-500" />
                  <span className="text-xs">Add Client</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1 border-cream-200 hover:bg-sal-50 hover:border-sal-200"
                  onClick={() => router.push("/calendar")}
                >
                  <Clock className="w-5 h-5 text-sal-500" />
                  <span className="text-xs">Block Time</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1 border-cream-200 hover:bg-sal-50 hover:border-sal-200"
                  onClick={() => router.push("/reports")}
                >
                  <TrendingUp className="w-5 h-5 text-sal-500" />
                  <span className="text-xs">View Reports</span>
                </Button>
              </CardContent>
            </Card>

            {/* Recent Clients */}
            <Card className="border-cream-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-heading">Recent Clients</CardTitle>
                <Button variant="ghost" size="sm" className="text-sal-600" onClick={() => router.push("/clients")}>
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentClients.map((client, index) => (
                    <Link key={client.id} href={`/clients/${client.id}`}>
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-cream-100 cursor-pointer transition-all border border-transparent hover:border-cream-200"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={client.avatar} />
                          <AvatarFallback className="bg-sal-100 text-sal-700 text-sm">
                            {client.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {client.name}
                            </p>
                            {client.tags?.includes("VIP") && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                VIP
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {client.totalVisits} visits · {formatCurrency(client.totalSpent)}
                          </p>
                        </div>
                        <div className="text-right hidden group-hover:block">
                          <p className="text-[10px] text-muted-foreground/70">
                            {client.lastVisit
                              ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(client.lastVisit))
                              : "No visits"}
                          </p>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
