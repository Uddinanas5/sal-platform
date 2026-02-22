"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
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
import { cn, formatDate } from "@/lib/utils"
import { type Staff } from "@/data/mock-data"
import { toast } from "sonner"

interface StaffTimeOffTabProps {
  staff: Staff
}

interface TimeOffEntry {
  id: string
  startDate: Date
  endDate: Date
  type: "vacation" | "sick" | "personal"
  status: "approved" | "pending" | "denied"
  notes?: string
}

const typeConfig = {
  vacation: { label: "Vacation", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  sick: { label: "Sick Leave", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  personal: { label: "Personal", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
}

const statusConfig = {
  approved: {
    label: "Approved",
    icon: CheckCircle,
    color: "bg-green-500/10 text-green-700 dark:text-green-300",
  },
  pending: {
    label: "Pending",
    icon: AlertCircle,
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  denied: {
    label: "Denied",
    icon: XCircle,
    color: "bg-red-500/10 text-red-700 dark:text-red-300",
  },
}

const mockUpcomingTimeOff: TimeOffEntry[] = [
  {
    id: "to1",
    startDate: new Date("2026-03-10"),
    endDate: new Date("2026-03-14"),
    type: "vacation",
    status: "approved",
    notes: "Spring break family trip",
  },
  {
    id: "to2",
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-04-02"),
    type: "personal",
    status: "pending",
    notes: "Dental appointment",
  },
  {
    id: "to3",
    startDate: new Date("2026-05-20"),
    endDate: new Date("2026-05-24"),
    type: "vacation",
    status: "pending",
    notes: "Summer vacation",
  },
]

const mockPastTimeOff: TimeOffEntry[] = [
  {
    id: "to4",
    startDate: new Date("2026-01-06"),
    endDate: new Date("2026-01-08"),
    type: "sick",
    status: "approved",
    notes: "Flu recovery",
  },
  {
    id: "to5",
    startDate: new Date("2025-12-23"),
    endDate: new Date("2025-12-26"),
    type: "vacation",
    status: "approved",
    notes: "Holiday break",
  },
  {
    id: "to6",
    startDate: new Date("2025-11-15"),
    endDate: new Date("2025-11-15"),
    type: "personal",
    status: "approved",
  },
]

function getDayCount(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1)
}

function TimeOffCard({ entry }: { entry: TimeOffEntry }) {
  const typeInfo = typeConfig[entry.type]
  const statusInfo = statusConfig[entry.status]
  const StatusIcon = statusInfo.icon
  const days = getDayCount(entry.startDate, entry.endDate)

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-cream-200 bg-card">
      <div className="w-10 h-10 rounded-lg bg-cream-100 flex items-center justify-center shrink-0">
        <Calendar className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={cn("text-xs", typeInfo.color)}>
            {typeInfo.label}
          </Badge>
          <Badge
            variant="secondary"
            className={cn("text-xs", statusInfo.color)}
          >
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </div>
        <p className="text-sm font-medium text-foreground mt-1">
          {formatDate(entry.startDate)}
          {entry.startDate.toDateString() !== entry.endDate.toDateString() &&
            ` - ${formatDate(entry.endDate)}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {days} day{days > 1 ? "s" : ""}
        </p>
        {entry.notes && (
          <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
        )}
      </div>
    </div>
  )
}

export function StaffTimeOffTab({ staff }: StaffTimeOffTabProps) {
  const [requestOpen, setRequestOpen] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [type, setType] = useState<string>("vacation")
  const [notes, setNotes] = useState("")

  const totalUpcoming = mockUpcomingTimeOff.reduce(
    (sum, e) => sum + getDayCount(e.startDate, e.endDate),
    0
  )

  const handleSubmitRequest = () => {
    if (!startDate || !endDate) {
      toast.error("Please select start and end dates")
      return
    }
    toast.success("Time off request submitted for approval")
    setRequestOpen(false)
    setStartDate("")
    setEndDate("")
    setType("vacation")
    setNotes("")
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Upcoming Days Off</p>
                  <p className="text-xl font-bold text-foreground">
                    {totalUpcoming} days
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending Requests</p>
                  <p className="text-xl font-bold text-foreground">
                    {mockUpcomingTimeOff.filter((e) => e.status === "pending").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Days Used (Year)</p>
                  <p className="text-xl font-bold text-foreground">8 days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming Time Off */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Upcoming Time Off</h3>
          <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Request Time Off
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Request Time Off</DialogTitle>
                <DialogDescription>
                  Submit a time off request for {staff.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="Reason for time off..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRequestOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmitRequest}>Submit Request</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {mockUpcomingTimeOff.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <TimeOffCard entry={entry} />
            </motion.div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Past Time Off */}
      <div>
        <h3 className="font-semibold text-foreground mb-4">
          Past Time Off History
        </h3>
        <div className="space-y-3">
          {mockPastTimeOff.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <TimeOffCard entry={entry} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
