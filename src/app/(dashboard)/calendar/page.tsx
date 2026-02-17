"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Grid3X3,
  List,
  Clock,
} from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatTime } from "@/lib/utils"
import { mockAppointments, mockStaff, mockServices } from "@/data/mock-data"

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM to 7 PM
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function getWeekDays(date: Date) {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}

export default function CalendarPage() {
  const [view, setView] = useState<"week" | "day">("week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedStaff, setSelectedStaff] = useState<string>("all")

  const weekDays = getWeekDays(currentDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + direction * 7)
    setCurrentDate(newDate)
  }

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + direction)
    setCurrentDate(newDate)
  }

  const monthYear = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(currentDate)

  const getAppointmentsForSlot = (date: Date, hour: number) => {
    return mockAppointments.filter((apt) => {
      const aptDate = new Date(apt.startTime)
      const aptHour = aptDate.getHours()
      const isSameDay =
        aptDate.getDate() === date.getDate() &&
        aptDate.getMonth() === date.getMonth() &&
        aptDate.getFullYear() === date.getFullYear()
      const matchesStaff =
        selectedStaff === "all" || apt.staffId === selectedStaff
      return isSameDay && aptHour === hour && matchesStaff
    })
  }

  const getServiceColor = (serviceId: string) => {
    const service = mockServices.find((s) => s.id === serviceId)
    return service?.color || "#f97316"
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Calendar"
        subtitle="Manage your appointments and schedule"
      />

      <div className="p-6 space-y-6">
        {/* Calendar Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => (view === "week" ? navigateWeek(-1) : navigateDay(-1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => (view === "week" ? navigateWeek(1) : navigateDay(1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{monthYear}</h2>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {mockStaff.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Tabs value={view} onValueChange={(v) => setView(v as "week" | "day")}>
              <TabsList>
                <TabsTrigger value="week" className="gap-2">
                  <Grid3X3 className="w-4 h-4" />
                  Week
                </TabsTrigger>
                <TabsTrigger value="day" className="gap-2">
                  <List className="w-4 h-4" />
                  Day
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Appointment
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <Card className="overflow-hidden">
          <AnimatePresence mode="wait">
            {view === "week" ? (
              <motion.div
                key="week"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-x-auto"
              >
                {/* Week Header */}
                <div className="grid grid-cols-8 border-b bg-gray-50/50">
                  <div className="p-4 border-r" />
                  {weekDays.map((day, i) => {
                    const isToday = day.toDateString() === today.toDateString()
                    return (
                      <div
                        key={i}
                        className={cn(
                          "p-4 text-center border-r last:border-r-0",
                          isToday && "bg-sal-50"
                        )}
                      >
                        <p className="text-xs text-gray-500 uppercase">
                          {DAYS[day.getDay()]}
                        </p>
                        <p
                          className={cn(
                            "text-2xl font-semibold mt-1",
                            isToday
                              ? "text-sal-600"
                              : "text-gray-900"
                          )}
                        >
                          {day.getDate()}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Time Slots */}
                <div className="relative">
                  {HOURS.map((hour) => (
                    <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
                      <div className="p-2 pr-4 text-right border-r">
                        <span className="text-xs text-gray-500">
                          {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}
                        </span>
                      </div>
                      {weekDays.map((day, dayIndex) => {
                        const appointments = getAppointmentsForSlot(day, hour)
                        const isToday = day.toDateString() === today.toDateString()
                        return (
                          <div
                            key={dayIndex}
                            className={cn(
                              "min-h-[60px] border-r last:border-r-0 p-1 relative group hover:bg-gray-50 transition-colors",
                              isToday && "bg-sal-50/30"
                            )}
                          >
                            {appointments.map((apt) => (
                              <motion.div
                                key={apt.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.02, zIndex: 10 }}
                                className="absolute inset-x-1 rounded-lg p-2 cursor-pointer shadow-sm hover:shadow-md transition-all"
                                style={{
                                  backgroundColor: `${getServiceColor(apt.serviceId)}20`,
                                  borderLeft: `3px solid ${getServiceColor(apt.serviceId)}`,
                                }}
                              >
                                <p
                                  className="text-xs font-medium truncate"
                                  style={{ color: getServiceColor(apt.serviceId) }}
                                >
                                  {apt.clientName}
                                </p>
                                <p className="text-[10px] text-gray-600 truncate">
                                  {apt.serviceName}
                                </p>
                              </motion.div>
                            ))}
                            <button className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Plus className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="day"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                {/* Day View Header */}
                <div className="mb-6 text-center">
                  <p className="text-gray-500">
                    {new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
                      currentDate
                    )}
                  </p>
                  <h3 className="text-3xl font-bold text-gray-900">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "long",
                      day: "numeric",
                    }).format(currentDate)}
                  </h3>
                </div>

                {/* Day Schedule */}
                <div className="space-y-2 max-w-3xl mx-auto">
                  {HOURS.map((hour) => {
                    const appointments = getAppointmentsForSlot(currentDate, hour)
                    return (
                      <div
                        key={hour}
                        className="flex gap-4 group"
                      >
                        <div className="w-20 text-right py-3">
                          <span className="text-sm text-gray-500">
                            {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}
                          </span>
                        </div>
                        <div className="flex-1 border-l-2 border-gray-200 pl-4 min-h-[60px] relative">
                          {appointments.length > 0 ? (
                            <div className="space-y-2">
                              {appointments.map((apt) => (
                                <motion.div
                                  key={apt.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  whileHover={{ scale: 1.01 }}
                                  className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer"
                                  style={{
                                    borderLeft: `4px solid ${getServiceColor(apt.serviceId)}`,
                                  }}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="w-10 h-10">
                                        <AvatarImage src={apt.clientAvatar} />
                                        <AvatarFallback className="bg-sal-100 text-sal-600">
                                          {apt.clientName.split(" ").map((n) => n[0]).join("")}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="font-medium text-gray-900">
                                          {apt.clientName}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          {apt.serviceName}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <Badge variant="success">{apt.status}</Badge>
                                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatTime(apt.startTime)} - {formatTime(apt.endTime)}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-2">
                                    with {apt.staffName}
                                  </p>
                                </motion.div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-full flex items-center">
                              <button className="opacity-0 group-hover:opacity-100 transition-opacity text-sm text-gray-400 hover:text-sal-500 flex items-center gap-1">
                                <Plus className="w-4 h-4" />
                                Add appointment
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Staff Legend */}
        <Card className="p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Staff:</span>
            {mockStaff.map((staff) => (
              <div key={staff.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: staff.color }}
                />
                <span className="text-sm text-gray-600">{staff.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
