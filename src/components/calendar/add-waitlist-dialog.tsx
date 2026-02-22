"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
import { addToWaitlist } from "@/lib/actions/waitlist"

interface AddWaitlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: Array<{
    id: string
    name: string
    duration: number
    price: number
    category: string
    color: string
    isActive: boolean
    description: string
  }>
  staff: Array<{
    id: string
    name: string
    color: string
    isActive: boolean
  }>
  clients: Array<{
    id: string
    name: string
    email: string
    phone: string
  }>
}

export function AddWaitlistDialog({
  open,
  onOpenChange,
  services,
  staff,
  clients,
}: AddWaitlistDialogProps) {
  const router = useRouter()
  const [clientId, setClientId] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [staffId, setStaffId] = useState("")
  const [preferredDate, setPreferredDate] = useState<Date | undefined>()
  const [preferredTimeStart, setPreferredTimeStart] = useState("")
  const [preferredTimeEnd, setPreferredTimeEnd] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)

  // Reset form on open
  useEffect(() => {
    if (open) {
      setClientId("")
      setClientSearch("")
      setServiceId("")
      setStaffId("")
      setPreferredDate(undefined)
      setPreferredTimeStart("")
      setPreferredTimeEnd("")
      setNotes("")
    }
  }, [open])

  const filteredClients = clients.filter((c) => {
    if (!clientSearch.trim()) return true
    const search = clientSearch.toLowerCase()
    return (
      c.name.toLowerCase().includes(search) ||
      c.email.toLowerCase().includes(search) ||
      c.phone.includes(search)
    )
  })

  const selectedClient = clients.find((c) => c.id === clientId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!clientId) {
      toast.error("Please select a client")
      return
    }

    setSubmitting(true)
    try {
      await addToWaitlist({
        clientId,
        serviceId: serviceId || undefined,
        staffId: staffId || undefined,
        preferredDate: preferredDate || undefined,
        preferredTimeStart: preferredTimeStart || undefined,
        preferredTimeEnd: preferredTimeEnd || undefined,
        notes: notes || undefined,
      })
      toast.success("Added to waitlist", {
        description: `${selectedClient?.name || "Client"} has been added to the waitlist.`,
      })
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error("Failed to add to waitlist")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col p-0 gap-0">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-heading">
              Add to Waitlist
            </DialogTitle>
            <DialogDescription>
              Add a client to the waitlist for when an opening becomes available.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Separator />

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Client selector */}
          <div className="space-y-1.5">
            <Label htmlFor="waitlist-client">
              Client <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="waitlist-client"
                placeholder="Search for a client..."
                value={selectedClient ? selectedClient.name : clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value)
                  setClientId("")
                  setShowClientDropdown(true)
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => {
                  // Delay hiding so click can register
                  setTimeout(() => setShowClientDropdown(false), 200)
                }}
              />
              {showClientDropdown && !clientId && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-cream-200 rounded-lg shadow-md max-h-[180px] overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3 px-3 text-center">
                      No clients found
                    </p>
                  ) : (
                    filteredClients.slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setClientId(c.id)
                          setClientSearch("")
                          setShowClientDropdown(false)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream-100 transition-colors"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground text-xs truncate">
                          {c.email}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Service preference */}
          <div className="space-y-1.5">
            <Label htmlFor="waitlist-service">Service preference</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger id="waitlist-service">
                <SelectValue placeholder="Any service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any service</SelectItem>
                {services
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Staff preference */}
          <div className="space-y-1.5">
            <Label htmlFor="waitlist-staff">Staff preference</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger id="waitlist-staff">
                <SelectValue placeholder="Any staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any staff</SelectItem>
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

          {/* Preferred date */}
          <div className="space-y-1.5">
            <Label>Preferred date</Label>
            <DatePicker
              date={preferredDate}
              onSelect={setPreferredDate}
              placeholder="Any date"
            />
          </div>

          {/* Preferred time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="waitlist-time-start">From</Label>
              <Input
                id="waitlist-time-start"
                type="time"
                value={preferredTimeStart}
                onChange={(e) => setPreferredTimeStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="waitlist-time-end">To</Label>
              <Input
                id="waitlist-time-end"
                type="time"
                value={preferredTimeEnd}
                onChange={(e) => setPreferredTimeEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="waitlist-notes">Notes</Label>
            <Textarea
              id="waitlist-notes"
              placeholder="Any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              showCounter
            />
          </div>
        </form>

        <Separator />

        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!clientId || submitting}
          >
            {submitting ? "Adding..." : "Add to Waitlist"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
