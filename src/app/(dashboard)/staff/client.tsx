"use client"

import React, { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  Search,
  MoreVertical,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCircle,
  User,
  CalendarDays,
  MessageSquare,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"
import type { Staff, Service } from "@/data/mock-data"
import { createStaff, deleteStaff } from "@/lib/actions/staff"

const roleConfig = {
  admin: { label: "Admin", icon: ShieldAlert, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  manager: { label: "Manager", icon: ShieldCheck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  staff: { label: "Staff", icon: Shield, color: "text-muted-foreground", bg: "bg-cream-200 dark:bg-cream-200/20" },
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

interface StaffClientProps {
  initialStaff: Staff[]
  services: Service[]
}

function StaffCard({ staff, index, onDelete, allServices }: { staff: Staff; index: number; onDelete: (staff: Staff) => void; allServices: Service[] }) {
  const [isActive, setIsActive] = useState(staff.isActive)
  const roleInfo = roleConfig[staff.role]
  const RoleIcon = roleInfo.icon

  const staffServices = allServices.filter((s) =>
    staff.services.includes(s.id)
  )

  return (
    <Link href={`/staff/${staff.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ y: -2 }}
        className={cn(
          "bg-card rounded-2xl border border-cream-200 shadow-sm hover:shadow-lg transition-all overflow-hidden card-warm cursor-pointer",
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-white/50 hover:bg-white/80"
                onClick={(e) => e.preventDefault()}
                aria-label="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
              <DropdownMenuItem onClick={() => toast.info(`Viewing profile for ${staff.name}`)}>
                <User className="w-4 h-4 mr-2" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info(`Editing schedule for ${staff.name}`)}>
                <CalendarDays className="w-4 h-4 mr-2" />
                Edit Schedule
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success(`Message sent to ${staff.name}`)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => onDelete(staff)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="pt-10 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-foreground">{staff.name}</h3>
                <Badge
                  variant="secondary"
                  className={cn("text-xs", roleInfo.bg, roleInfo.color)}
                >
                  <RoleIcon className="w-3 h-3 mr-1" />
                  {roleInfo.label}
                </Badge>
              </div>
            </div>
            <div onClick={(e) => e.preventDefault()}>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span>{staff.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span>{staff.phone}</span>
            </div>
          </div>

          {/* Services */}
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Services</p>
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
            <p className="text-xs text-muted-foreground mb-2">Working Days</p>
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
                        : "bg-cream-200 text-muted-foreground/70"
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
    </Link>
  )
}

export function StaffClient(props: StaffClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newStaffName, setNewStaffName] = useState("")
  const [newStaffEmail, setNewStaffEmail] = useState("")
  const [newStaffPhone, setNewStaffPhone] = useState("")
  const [newStaffRole, setNewStaffRole] = useState("")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [addStaffErrors, setAddStaffErrors] = useState<{ name?: string; email?: string; role?: string }>({})
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null)

  const filteredStaff = props.initialStaff.filter((staff) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q ||
      staff.name.toLowerCase().includes(q) ||
      staff.email.toLowerCase().includes(q) ||
      staff.phone.includes(q)
    const matchesRole = roleFilter === "all" || staff.role === roleFilter
    return matchesSearch && matchesRole
  })

  const totalStaff = props.initialStaff.length
  const activeStaff = props.initialStaff.filter((s) => s.isActive).length

  const handleAddStaff = async () => {
    const errors: { name?: string; email?: string; role?: string } = {}
    if (!newStaffName.trim()) errors.name = "Name is required"
    if (!newStaffEmail.trim()) {
      errors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newStaffEmail)) {
      errors.email = "Please enter a valid email address"
    }
    if (!newStaffRole) errors.role = "Please select a role"
    if (Object.keys(errors).length > 0) {
      setAddStaffErrors(errors)
      return
    }

    const nameParts = newStaffName.trim().split(/\s+/)
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(" ") || ""

    const result = await createStaff({
      firstName,
      lastName,
      email: newStaffEmail.trim(),
      phone: newStaffPhone.trim() || undefined,
      role: newStaffRole,
      serviceIds: selectedServices.length > 0 ? selectedServices : undefined,
    })

    if (result.success) {
      toast.success(`Staff member "${newStaffName.trim()}" added successfully`)
      setIsAddDialogOpen(false)
      setNewStaffName("")
      setNewStaffEmail("")
      setNewStaffPhone("")
      setNewStaffRole("")
      setSelectedServices([])
      setAddStaffErrors({})
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const result = await deleteStaff(deleteTarget.id)
    if (result.success) {
      toast.success(`Staff member "${deleteTarget.name}" deleted`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-screen bg-cream">
      <Header title="Staff" subtitle="Manage your team members" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Staff", value: totalStaff },
            { label: "Active Staff", value: activeStaff },
            { label: "Admins", value: props.initialStaff.filter((s) => s.role === "admin").length },
            { label: "Avg. Services", value: Math.round(props.initialStaff.reduce((sum, s) => sum + s.services.length, 0) / totalStaff) },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-heading font-bold text-foreground mt-1">
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
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

          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) {
              setNewStaffName("")
              setNewStaffEmail("")
              setNewStaffPhone("")
              setNewStaffRole("")
              setSelectedServices([])
              setAddStaffErrors({})
            }
          }}>
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
                  <Input
                    placeholder="John Doe"
                    value={newStaffName}
                    onChange={(e) => {
                      setNewStaffName(e.target.value)
                      if (addStaffErrors.name) setAddStaffErrors((prev) => ({ ...prev, name: undefined }))
                    }}
                  />
                  {addStaffErrors.name && (
                    <p className="text-xs text-red-500">{addStaffErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="john@salon.com"
                    value={newStaffEmail}
                    onChange={(e) => {
                      setNewStaffEmail(e.target.value)
                      if (addStaffErrors.email) setAddStaffErrors((prev) => ({ ...prev, email: undefined }))
                    }}
                  />
                  {addStaffErrors.email && (
                    <p className="text-xs text-red-500">{addStaffErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    placeholder="+1 (555) 000-0000"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={newStaffRole} onValueChange={(v) => {
                    setNewStaffRole(v)
                    if (addStaffErrors.role) setAddStaffErrors((prev) => ({ ...prev, role: undefined }))
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  {addStaffErrors.role && (
                    <p className="text-xs text-red-500">{addStaffErrors.role}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Services</label>
                  <p className="text-xs text-muted-foreground">
                    Select services this staff member can perform
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {props.services.map((service) => {
                      const isSelected = selectedServices.includes(service.id)
                      return (
                        <Badge
                          key={service.id}
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "bg-sal-500 text-white hover:bg-sal-600"
                              : "hover:bg-sal-50"
                          )}
                          onClick={() => {
                            setSelectedServices((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== service.id)
                                : [...prev, service.id]
                            )
                          }}
                        >
                          {service.name}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStaff}>
                  Add Member
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map((staff, index) => (
            <StaffCard key={staff.id} staff={staff} index={index} onDelete={setDeleteTarget} allServices={props.services} />
          ))}
        </div>

        {filteredStaff.length === 0 && (
          <EmptyState
            icon={<UserCircle className="w-8 h-8 text-sal-600" />}
            title="No staff members found"
            description="No staff members match your current search or role filter. Try adjusting your criteria or add a new team member."
            action={{
              label: "Add Staff Member",
              onClick: () => setIsAddDialogOpen(true),
            }}
          />
        )}

        {/* Schedule Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Weekly Schedule Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cream-200">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Staff
                    </th>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="text-center py-3 px-2 font-medium text-muted-foreground text-sm capitalize"
                      >
                        {day.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {props.initialStaff.map((staff) => (
                    <tr key={staff.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/staff/${staff.id}`}
                          className="flex items-center gap-2 hover:text-sal-600 transition-colors"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: staff.color }}
                          />
                          <span className="font-medium text-sm">{staff.name}</span>
                        </Link>
                      </td>
                      {DAYS.map((day) => {
                        const hours = staff.workingHours[day]
                        return (
                          <td key={day} className="py-3 px-2 text-center">
                            {hours ? (
                              <span className="text-xs text-muted-foreground">
                                {hours.start}-{hours.end}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/70">Off</span>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Staff Member"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
