"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Plus,
  Search,
  MoreVertical,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { mockStaff, mockServices, type Staff } from "@/data/mock-data"

const roleConfig = {
  admin: { label: "Admin", icon: ShieldAlert, color: "text-red-600", bg: "bg-red-100" },
  manager: { label: "Manager", icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-100" },
  staff: { label: "Staff", icon: Shield, color: "text-gray-600", bg: "bg-gray-100" },
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

function StaffCard({ staff, index }: { staff: Staff; index: number }) {
  const [isActive, setIsActive] = useState(staff.isActive)
  const roleInfo = roleConfig[staff.role]
  const RoleIcon = roleInfo.icon

  const staffServices = mockServices.filter((s) =>
    staff.services.includes(s.id)
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -2 }}
      className={cn(
        "bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-all overflow-hidden",
        !isActive && "opacity-60"
      )}
    >
      {/* Header with color */}
      <div
        className="h-20 relative"
        style={{
          background: `linear-gradient(135deg, ${staff.color}40 0%, ${staff.color}20 100%)`,
        }}
      >
        <div className="absolute -bottom-8 left-5">
          <Avatar className="w-16 h-16 ring-4 ring-white">
            <AvatarImage src={staff.avatar} />
            <AvatarFallback
              className="text-xl font-semibold"
              style={{ backgroundColor: staff.color, color: "white" }}
            >
              {staff.name.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 bg-white/50 hover:bg-white/80"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      <div className="pt-10 p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-gray-900">{staff.name}</h3>
              <Badge
                variant="secondary"
                className={cn("text-xs", roleInfo.bg, roleInfo.color)}
              >
                <RoleIcon className="w-3 h-3 mr-1" />
                {roleInfo.label}
              </Badge>
            </div>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4" />
            <span>{staff.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4" />
            <span>{staff.phone}</span>
          </div>
        </div>

        {/* Services */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Services</p>
          <div className="flex flex-wrap gap-1">
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

        {/* Working Hours */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Working Days</p>
          <div className="flex gap-1">
            {DAYS.map((day) => {
              const isWorking = staff.workingHours[day] !== null
              return (
                <div
                  key={day}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors",
                    isWorking
                      ? "bg-sal-100 text-sal-700"
                      : "bg-gray-100 text-gray-400"
                  )}
                >
                  {day.charAt(0).toUpperCase()}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function StaffPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const filteredStaff = mockStaff.filter((staff) => {
    const matchesSearch = staff.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || staff.role === roleFilter
    return matchesSearch && matchesRole
  })

  const totalStaff = mockStaff.length
  const activeStaff = mockStaff.filter((s) => s.isActive).length

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Staff" subtitle="Manage your team members" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Staff", value: totalStaff },
            { label: "Active Staff", value: activeStaff },
            { label: "Admins", value: mockStaff.filter((s) => s.role === "admin").length },
            { label: "Avg. Services", value: Math.round(mockStaff.reduce((sum, s) => sum + s.services.length, 0) / totalStaff) },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Staff Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Add a new staff member to your team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" placeholder="john@salon.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Services</label>
                  <p className="text-xs text-gray-500">
                    Select services this staff member can perform
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {mockServices.map((service) => (
                      <Badge
                        key={service.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-sal-50"
                      >
                        {service.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsAddDialogOpen(false)}>
                  Add Member
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map((staff, index) => (
            <StaffCard key={staff.id} staff={staff} index={index} />
          ))}
        </div>

        {filteredStaff.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No staff members found.</p>
            <Button variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add your first team member
            </Button>
          </div>
        )}

        {/* Schedule Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Schedule Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
                      Staff
                    </th>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="text-center py-3 px-2 font-medium text-gray-500 text-sm capitalize"
                      >
                        {day.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockStaff.map((staff) => (
                    <tr key={staff.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: staff.color }}
                          />
                          <span className="font-medium text-sm">{staff.name}</span>
                        </div>
                      </td>
                      {DAYS.map((day) => {
                        const hours = staff.workingHours[day]
                        return (
                          <td key={day} className="py-3 px-2 text-center">
                            {hours ? (
                              <span className="text-xs text-gray-600">
                                {hours.start}-{hours.end}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">Off</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
