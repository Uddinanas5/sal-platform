"use client"

import React, { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useSession } from "next-auth/react"
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
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
import { cn, formatDateUTC } from "@/lib/utils"
import { type Staff } from "@/data/mock-data"
import { toast } from "sonner"
import {
  approveTimeOff,
  getStaffTimeOff,
  rejectTimeOff,
  requestTimeOff,
  type TimeOffRow,
} from "@/lib/actions/staff"

interface StaffTimeOffTabProps {
  staff: Staff
}

const typeConfig: Record<TimeOffRow["type"], { label: string; color: string }> = {
  vacation: { label: "Vacation", color: "bg-blue-500/10 text-blue-300" },
  sick: { label: "Sick Leave", color: "bg-amber-500/10 text-amber-300" },
  personal: { label: "Personal", color: "bg-purple-500/10 text-purple-300" },
  other: { label: "Other", color: "bg-gray-500/10 text-gray-300" },
}

// Status keys match the real TimeOffStatus enum (pending/approved/rejected).
const statusConfig: Record<TimeOffRow["status"], { label: string; icon: typeof CheckCircle; color: string }> = {
  approved: {
    label: "Approved",
    icon: CheckCircle,
    color: "bg-green-500/10 text-green-300",
  },
  pending: {
    label: "Pending",
    icon: AlertCircle,
    color: "bg-amber-500/10 text-amber-300",
  },
  rejected: {
    label: "Denied",
    icon: XCircle,
    color: "bg-red-500/10 text-red-300",
  },
}

function getDayCount(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1)
}

function TimeOffCard({
  entry,
  canDecide,
  onApprove,
  onReject,
  busy,
}: {
  entry: TimeOffRow
  canDecide: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  busy: boolean
}) {
  const typeInfo = typeConfig[entry.type] ?? typeConfig.other
  const statusInfo = statusConfig[entry.status] ?? statusConfig.pending
  const StatusIcon = statusInfo.icon
  const startDate = new Date(entry.startDate)
  const endDate = new Date(entry.endDate)
  const days = getDayCount(startDate, endDate)

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
          {formatDateUTC(startDate)}
          {startDate.toUTCString().slice(0, 16) !== endDate.toUTCString().slice(0, 16) &&
            ` - ${formatDateUTC(endDate)}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {days} day{days > 1 ? "s" : ""}
        </p>
        {entry.notes && (
          <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
        )}
        {canDecide && entry.status === "pending" && (
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onApprove(entry.id)}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onReject(entry.id)}
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Deny
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function StaffTimeOffTab({ staff }: StaffTimeOffTabProps) {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRole = (session?.user as any)?.role as string | undefined
  const canDecide = viewerRole === "admin" || viewerRole === "owner"

  const [entries, setEntries] = useState<TimeOffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const [requestOpen, setRequestOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [type, setType] = useState<string>("vacation")
  const [notes, setNotes] = useState("")

  const load = useCallback(async () => {
    const res = await getStaffTimeOff(staff.id)
    if (res.success) {
      setEntries(res.data)
    } else {
      toast.error(res.error || "Failed to load time off")
    }
    setLoading(false)
  }, [staff.id])

  useEffect(() => {
    void load()
  }, [load])

  // Split into upcoming (end date today or later) and past, by real dates.
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const upcoming = entries.filter((e) => new Date(e.endDate) >= now)
  const past = entries.filter((e) => new Date(e.endDate) < now)

  const totalUpcoming = upcoming
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + getDayCount(new Date(e.startDate), new Date(e.endDate)), 0)
  const pendingCount = entries.filter((e) => e.status === "pending").length
  const daysUsedThisYear = entries
    .filter((e) => e.status === "approved" && new Date(e.startDate).getFullYear() === now.getFullYear())
    .reduce((sum, e) => sum + getDayCount(new Date(e.startDate), new Date(e.endDate)), 0)

  const handleSubmitRequest = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select start and end dates")
      return
    }
    if (endDate < startDate) {
      toast.error("End date must be on or after start date")
      return
    }
    setSubmitting(true)
    const res = await requestTimeOff({
      staffId: staff.id,
      startDate,
      endDate,
      type: type as "vacation" | "sick" | "personal" | "other",
      notes: notes || undefined,
    })
    setSubmitting(false)
    if (res.success) {
      toast.success("Time off request submitted for approval")
      setRequestOpen(false)
      setStartDate("")
      setEndDate("")
      setType("vacation")
      setNotes("")
      await load()
    } else {
      toast.error(res.error || "Failed to submit request")
    }
  }

  const handleApprove = async (id: string) => {
    setDecidingId(id)
    const res = await approveTimeOff(id)
    setDecidingId(null)
    if (res.success) {
      toast.success("Time off approved — those dates are now blocked on the calendar")
      await load()
    } else {
      toast.error(res.error || "Failed to approve")
    }
  }

  const handleReject = async (id: string) => {
    setDecidingId(id)
    const res = await rejectTimeOff(id)
    setDecidingId(null)
    if (res.success) {
      toast.success("Time off request denied")
      await load()
    } else {
      toast.error(res.error || "Failed to deny")
    }
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
                <div className="w-10 h-10 rounded-lg bg-blue-400/15 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-400" />
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
                <div className="w-10 h-10 rounded-lg bg-amber-400/15 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending Requests</p>
                  <p className="text-xl font-bold text-foreground">
                    {pendingCount}
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
                <div className="w-10 h-10 rounded-lg bg-green-400/15 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Days Used (Year)</p>
                  <p className="text-xl font-bold text-foreground">{daysUsedThisYear} days</p>
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
                      <SelectItem value="other">Other</SelectItem>
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
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmitRequest} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading time off...
          </div>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No upcoming time off.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <TimeOffCard
                  entry={entry}
                  canDecide={canDecide}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  busy={decidingId === entry.id}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Past Time Off */}
      <div>
        <h3 className="font-semibold text-foreground mb-4">
          Past Time Off History
        </h3>
        {loading ? null : past.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No past time off.</p>
        ) : (
          <div className="space-y-3">
            {past.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <TimeOffCard
                  entry={entry}
                  canDecide={false}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  busy={false}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
