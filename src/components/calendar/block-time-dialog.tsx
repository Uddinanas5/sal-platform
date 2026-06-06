"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Separator } from "@/components/ui/separator"
import { createTimeBlock } from "@/lib/actions/staff"

interface BlockTimeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: Array<{
    id: string
    name: string
    color: string
    isActive: boolean
  }>
  /** Pre-fill the staff column the user blocked from (optional). */
  initialStaffId?: string
  /** Pre-fill the day being viewed (optional). */
  initialDate?: Date
  /** Pre-fill the start time "HH:MM" if blocked from a specific slot (optional). */
  initialStartTime?: string
  /** Pre-fill the end time "HH:MM" (optional). */
  initialEndTime?: string
}

export function BlockTimeDialog({
  open,
  onOpenChange,
  staff,
  initialStaffId,
  initialDate,
  initialStartTime,
  initialEndTime,
}: BlockTimeDialogProps) {
  const router = useRouter()
  const [staffId, setStaffId] = useState("")
  const [date, setDate] = useState<Date | undefined>()
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Reset / pre-fill the form whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setStaffId(initialStaffId ?? "")
      setDate(initialDate ?? new Date())
      setStartTime(initialStartTime ?? "")
      setEndTime(initialEndTime ?? "")
      setReason("")
    }
  }, [open, initialStaffId, initialDate, initialStartTime, initialEndTime])

  const canSubmit =
    !!staffId && !!date && !!startTime && !!endTime && reason.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!staffId) return toast.error("Please select a staff member")
    if (!date) return toast.error("Please pick a date")
    if (!startTime || !endTime) return toast.error("Please set a start and end time")
    if (startTime >= endTime) return toast.error("End time must be after start time")
    if (!reason.trim()) return toast.error("Please add a reason")

    setSubmitting(true)
    try {
      const res = await createTimeBlock({
        staffId,
        date: format(date, "yyyy-MM-dd"),
        startTime,
        endTime,
        reason: reason.trim(),
      })

      if (!res.success) {
        toast.error(res.error || "Failed to block time")
        return
      }

      const who = staff.find((s) => s.id === staffId)?.name ?? "Staff"
      toast.success("Time blocked", {
        description: `${who} is unavailable ${startTime}–${endTime} on ${format(date, "MMM d")}.`,
      })
      onOpenChange(false)
      // Re-fetch the server component so the block shows as unavailable.
      router.refresh()
    } catch {
      toast.error("Failed to block time")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[85vh] flex flex-col p-0 gap-0">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-heading">Block time</DialogTitle>
            <DialogDescription>
              Mark a staff member as unavailable for a one-off block — no formal
              time-off request needed.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Separator />

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {/* Staff */}
          <div className="space-y-1.5">
            <Label htmlFor="block-staff">
              Staff <span className="text-destructive">*</span>
            </Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger id="block-staff">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staff
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>
              Date <span className="text-destructive">*</span>
            </Label>
            <DatePicker date={date} onSelect={setDate} placeholder="Pick a date" />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-start">
                From <span className="text-destructive">*</span>
              </Label>
              <Input
                id="block-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-end">
                To <span className="text-destructive">*</span>
              </Label>
              <Input
                id="block-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {startTime && endTime && startTime >= endTime && (
            <p className="text-xs text-destructive">End time must be after start time.</p>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="block-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="block-reason"
              placeholder="e.g. Lunch, errand, personal appointment…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={200}
              showCounter
            />
          </div>
        </form>

        <Separator />

        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Blocking…" : "Block time"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
