"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Edit,
  Calendar,
  CalendarDays,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  LayoutDashboard,
  UserCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn, getInitials } from "@/lib/utils"
import type { Staff, Service, Appointment } from "@/data/mock-data"
import { StaffPerformanceTab } from "@/components/staff/staff-performance-tab"
import { StaffScheduleTab } from "@/components/staff/staff-schedule-tab"
import { StaffCommissionTab } from "@/components/staff/staff-commission-tab"
import { StaffTimeOffTab } from "@/components/staff/staff-timeoff-tab"
import { toast } from "sonner"

const roleConfig = {
  admin: {
    label: "Admin",
    icon: ShieldAlert,
    color: "text-red-600",
    bg: "bg-red-500/10",
  },
  manager: {
    label: "Manager",
    icon: ShieldCheck,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
  },
  staff: {
    label: "Staff",
    icon: Shield,
    color: "text-muted-foreground",
    bg: "bg-cream-200",
  },
}

interface StaffPerformanceData {
  name: string
  appointments: number
  revenue: number
  rating: number
  commission: number
}

interface StaffDetailClientProps {
  staff: Staff
  services: Service[]
  appointments: Appointment[]
  staffPerformance?: StaffPerformanceData | null
}

export function StaffDetailClient(props: StaffDetailClientProps) {
  const { staff, services, appointments, staffPerformance } = props
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("performance")

  const roleInfo = roleConfig[staff.role]
  const RoleIcon = roleInfo.icon
  const staffServices = services.filter((s) =>
    staff.services.includes(s.id)
  )

  return (
    <div className="min-h-screen bg-cream">
      {/* Breadcrumb navigation */}
      <div className="h-12 bg-card/80 backdrop-blur-sm border-b border-cream-200 px-6 flex items-center sticky top-0 z-30">
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/dashboard" className="text-muted-foreground/70 hover:text-muted-foreground transition-colors flex items-center gap-1">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/70" />
          <Link href="/staff" className="text-muted-foreground/70 hover:text-muted-foreground transition-colors flex items-center gap-1">
            <UserCircle className="w-3.5 h-3.5" />
            Staff
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/70" />
          <span className="text-foreground font-medium">{staff.name}</span>
        </nav>
      </div>

      <div className="p-6 space-y-6">

        {/* Staff Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-cream-200 shadow-sm overflow-hidden"
        >
          {/* Banner */}
          <div
            className="h-28 relative"
            style={{
              background: `linear-gradient(135deg, ${staff.color}40 0%, ${staff.color}15 100%)`,
            }}
          />

          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start gap-4 -mt-12">
              {/* Avatar */}
              <Avatar className="w-24 h-24 ring-4 ring-white shadow-lg">
                <AvatarImage src={staff.avatar} />
                <AvatarFallback
                  className="text-2xl font-semibold"
                  style={{
                    backgroundColor: staff.color,
                    color: "white",
                  }}
                >
                  {getInitials(staff.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 pt-2 sm:pt-14">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-heading font-bold text-foreground">
                        {staff.name}
                      </h1>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          roleInfo.bg,
                          roleInfo.color
                        )}
                      >
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {roleInfo.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span>{staff.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{staff.phone}</span>
                      </div>
                    </div>

                    {/* Color indicator */}
                    <div className="flex items-center gap-2 mt-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: staff.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        Calendar color
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toast.info("Edit form coming soon")
                      }
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setActiveTab("schedule")
                      }
                    >
                      <CalendarDays className="w-4 h-4 mr-1" />
                      Manage Schedule
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push("/calendar")
                      }
                    >
                      <Calendar className="w-4 h-4 mr-1" />
                      View Calendar
                    </Button>
                  </div>
                </div>

                {/* Services Tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {staffServices.map((service) => (
                    <Badge
                      key={service.id}
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: service.color,
                        color: service.color,
                      }}
                    >
                      {service.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
            <TabsTrigger value="timeoff">Time Off</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <StaffPerformanceTab staff={staff} staffPerformance={staffPerformance} />
            </motion.div>
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <StaffScheduleTab staff={staff} />
            </motion.div>
          </TabsContent>

          <TabsContent value="commission" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <StaffCommissionTab staff={staff} appointments={appointments} />
            </motion.div>
          </TabsContent>

          <TabsContent value="timeoff" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <StaffTimeOffTab staff={staff} />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
