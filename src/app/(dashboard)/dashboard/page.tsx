"use client"

import React from "react"
import { motion } from "framer-motion"
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
import { formatCurrency } from "@/lib/utils"
import { mockAppointments, mockClients, dashboardStats } from "@/data/mock-data"

export default function DashboardPage() {
  const today = new Date()
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(today)

  const recentClients = mockClients.slice(0, 5)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Dashboard" subtitle={formattedDate} />

      <div className="p-6 space-y-6">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sal-500 via-sal-600 to-sal-700 p-6 text-white"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium text-sal-100">AI Insight</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Good morning, Alex! 👋</h2>
            <p className="text-sal-100 max-w-xl">
              You have <span className="font-semibold text-white">8 appointments</span> today.
              Based on your booking trends, consider opening more slots on Thursdays –
              they&apos;re 23% busier than average!
            </p>
            <Button
              variant="secondary"
              className="mt-4 bg-white/20 hover:bg-white/30 text-white border-white/20"
            >
              View Insights
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 right-20 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Today's Revenue"
            value={formatCurrency(dashboardStats.todayRevenue)}
            change={12.5}
            changeLabel="vs yesterday"
            icon={DollarSign}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
            delay={0}
          />
          <StatsCard
            title="Today's Appointments"
            value={dashboardStats.todayAppointments}
            icon={Calendar}
            iconColor="text-sal-600"
            iconBgColor="bg-sal-100"
            delay={0.1}
          />
          <StatsCard
            title="Total Clients"
            value={dashboardStats.totalClients}
            change={dashboardStats.newClientsThisMonth}
            changeLabel="new this month"
            icon={Users}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
            delay={0.2}
          />
          <StatsCard
            title="Average Rating"
            value={dashboardStats.averageRating}
            icon={Star}
            iconColor="text-amber-600"
            iconBgColor="bg-amber-100"
            delay={0.3}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Today&apos;s Schedule</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {dashboardStats.completedAppointments} completed, {dashboardStats.upcomingAppointments} upcoming
                </p>
              </div>
              <Button variant="outline" size="sm">
                View Calendar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {mockAppointments.map((appointment, index) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      variant="compact"
                      index={index}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Sidebar Content */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <Calendar className="w-5 h-5 text-sal-500" />
                  <span className="text-xs">New Booking</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <Users className="w-5 h-5 text-sal-500" />
                  <span className="text-xs">Add Client</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <Clock className="w-5 h-5 text-sal-500" />
                  <span className="text-xs">Block Time</span>
                </Button>
                <Button variant="outline" className="h-auto py-3 flex-col gap-1">
                  <TrendingUp className="w-5 h-5 text-sal-500" />
                  <span className="text-xs">View Reports</span>
                </Button>
              </CardContent>
            </Card>

            {/* Recent Clients */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Recent Clients</CardTitle>
                <Button variant="ghost" size="sm" className="text-sal-500">
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentClients.map((client, index) => (
                    <motion.div
                      key={client.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={client.avatar} />
                        <AvatarFallback className="bg-sal-100 text-sal-600 text-sm">
                          {client.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {client.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {client.totalVisits} visits · {formatCurrency(client.totalSpent)}
                        </p>
                      </div>
                      {client.tags?.includes("VIP") && (
                        <Badge variant="default" className="text-[10px] px-1.5">
                          VIP
                        </Badge>
                      )}
                    </motion.div>
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
