"use client"

import React, { useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  CalendarCheck,
  X,
  Plus,
  Clock,
  Scissors,
  UserCheck,
  CalendarDays,
  ListX,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { removeFromWaitlist, notifyWaitlistEntry } from "@/lib/actions/waitlist"
import { AddWaitlistDialog } from "./add-waitlist-dialog"

export interface WaitlistEntry {
  id: string
  clientId: string
  serviceId: string | null
  staffId: string | null
  preferredDate: Date | string | null
  preferredTimeStart: Date | string | null
  preferredTimeEnd: Date | string | null
  status: string
  notes: string | null
  notifiedAt: Date | string | null
  createdAt: Date | string
}

interface WaitlistPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: WaitlistEntry[]
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
  onBookFromWaitlist?: (entry: WaitlistEntry) => void
}

function formatTimeValue(dateVal: Date | string | null): string {
  if (!dateVal) return ""
  try {
    const d = new Date(dateVal)
    const hours = d.getUTCHours()
    const minutes = d.getUTCMinutes()
    const ampm = hours >= 12 ? "PM" : "AM"
    const displayH = hours % 12 === 0 ? 12 : hours % 12
    return `${displayH}:${minutes.toString().padStart(2, "0")} ${ampm}`
  } catch {
    return String(dateVal)
  }
}

export function WaitlistPanel({
  open,
  onOpenChange,
  entries,
  services,
  staff,
  clients,
  onBookFromWaitlist,
}: WaitlistPanelProps) {
  const router = useRouter()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [notifyingId, setNotifyingId] = useState<string | null>(null)

  const waitingCount = entries.filter((e) => e.status === "waiting").length
  const notifiedCount = entries.length - waitingCount

  function getClientName(clientId: string): string {
    const client = clients.find((c) => c.id === clientId)
    return client ? client.name : "Client"
  }

  function getServiceName(serviceId: string | null): string | null {
    if (!serviceId) return null
    const service = services.find((s) => s.id === serviceId)
    return service ? service.name : null
  }

  function getStaffName(staffId: string | null): string | null {
    if (!staffId) return null
    const s = staff.find((st) => st.id === staffId)
    return s ? s.name : null
  }

  function getServiceColor(serviceId: string | null): string {
    if (!serviceId) return "#94a3b8"
    const service = services.find((s) => s.id === serviceId)
    return service?.color || "#94a3b8"
  }

  function getStaffColor(staffId: string | null): string {
    if (!staffId) return "#94a3b8"
    const s = staff.find((st) => st.id === staffId)
    return s?.color || "#94a3b8"
  }

  async function handleNotify(entryId: string) {
    setNotifyingId(entryId)
    try {
      await notifyWaitlistEntry(entryId)
      toast.success("Client notified", {
        description: "A notification has been sent to the client.",
      })
      router.refresh()
    } catch {
      toast.error("Failed to notify client")
    } finally {
      setNotifyingId(null)
    }
  }

  async function handleRemove(entryId: string) {
    setRemovingId(entryId)
    try {
      await removeFromWaitlist(entryId)
      toast.success("Removed from waitlist")
      router.refresh()
    } catch {
      toast.error("Failed to remove from waitlist")
    } finally {
      setRemovingId(null)
    }
  }

  function handleBook(entry: WaitlistEntry) {
    if (onBookFromWaitlist) {
      onBookFromWaitlist(entry)
    } else {
      toast.info("Book from waitlist", {
        description: "Use the calendar to create an appointment for this client.",
      })
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 sm:hidden"
              onClick={() => onOpenChange(false)}
            />

            {/* Slide-out panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className={cn(
                "fixed right-0 top-0 bottom-0 z-50 flex flex-col",
                "w-full sm:w-[380px] bg-background border-l border-cream-200 dark:border-muted shadow-2xl"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 dark:border-muted bg-card shrink-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-heading font-semibold text-foreground">
                    Waitlist
                  </h2>
                  {entries.length > 0 && (
                    <Badge variant="warning" className="text-[10px] px-2 py-0.5">
                      {waitingCount} waiting
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => setAddDialogOpen(true)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onOpenChange(false)}
                    aria-label="Close waitlist panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Summary counts */}
              {entries.length > 0 && (
                <div className="flex items-center gap-4 px-5 py-2 bg-cream-50 dark:bg-muted/30 border-b border-cream-100 dark:border-muted text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {waitingCount} waiting
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    {notifiedCount} notified
                  </span>
                </div>
              )}

              {/* Entries */}
              <ScrollArea className="flex-1">
                <div className="px-4 py-3">
                  {entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-12 h-12 rounded-full bg-cream-100 dark:bg-muted flex items-center justify-center mb-3">
                        <ListX className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        No one on the waitlist
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                        Add clients to the waitlist when they want a slot that is currently unavailable.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4 gap-1.5"
                        onClick={() => setAddDialogOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add to Waitlist
                      </Button>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      <div className="space-y-2">
                        {entries.map((entry) => {
                          const serviceName = getServiceName(entry.serviceId)
                          const staffName = getStaffName(entry.staffId)
                          const clientName = getClientName(entry.clientId)
                          const serviceColor = getServiceColor(entry.serviceId)
                          const staffColor = getStaffColor(entry.staffId)
                          const createdAt = new Date(entry.createdAt)
                          const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true })

                          const timeStart = formatTimeValue(entry.preferredTimeStart)
                          const timeEnd = formatTimeValue(entry.preferredTimeEnd)
                          const hasTimeRange = timeStart && timeEnd

                          const prefDate = entry.preferredDate
                            ? format(new Date(entry.preferredDate), "MMM d, yyyy")
                            : null

                          return (
                            <motion.div
                              key={entry.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: 40, scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                              className="group relative rounded-xl border border-cream-200 dark:border-muted bg-card p-3.5 hover:shadow-sm transition-shadow"
                            >
                              {/* Top row: client + status */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="w-2 h-8 rounded-full shrink-0"
                                    style={{ backgroundColor: serviceColor }}
                                  />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">
                                      {clientName}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Added {timeAgo}
                                    </p>
                                  </div>
                                </div>
                                <Badge
                                  variant={entry.status === "waiting" ? "warning" : "info"}
                                  className="text-[10px] shrink-0"
                                >
                                  {entry.status === "waiting" ? "Waiting" : "Notified"}
                                </Badge>
                              </div>

                              {/* Details */}
                              <div className="space-y-1 ml-4 mb-2.5">
                                {serviceName && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Scissors className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{serviceName}</span>
                                  </div>
                                )}
                                {staffName && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <UserCheck className="h-3 w-3 shrink-0" />
                                    <div className="flex items-center gap-1.5">
                                      <div
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: staffColor }}
                                      />
                                      <span className="truncate">{staffName}</span>
                                    </div>
                                  </div>
                                )}
                                {prefDate && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <CalendarDays className="h-3 w-3 shrink-0" />
                                    <span>{prefDate}</span>
                                  </div>
                                )}
                                {hasTimeRange && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    <span>
                                      {timeStart} - {timeEnd}
                                    </span>
                                  </div>
                                )}
                                {entry.notes && (
                                  <p className="text-[11px] text-muted-foreground/70 italic line-clamp-2 mt-1">
                                    &ldquo;{entry.notes}&rdquo;
                                  </p>
                                )}
                                {entry.status === "notified" && entry.notifiedAt && (
                                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                                    Notified{" "}
                                    {formatDistanceToNow(new Date(entry.notifiedAt), {
                                      addSuffix: true,
                                    })}
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5 ml-4">
                                {entry.status === "waiting" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleNotify(entry.id)}
                                    disabled={notifyingId === entry.id}
                                    className="h-7 text-xs gap-1 px-2"
                                    aria-label="Notify client"
                                  >
                                    {notifyingId === entry.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Bell className="h-3 w-3" />
                                    )}
                                    {notifyingId === entry.id ? "Sending..." : "Notify"}
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleBook(entry)}
                                  className="h-7 text-xs gap-1 px-2"
                                  aria-label="Book appointment from waitlist"
                                >
                                  <CalendarCheck className="h-3 w-3" />
                                  Book
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemove(entry.id)}
                                  disabled={removingId === entry.id}
                                  className="h-7 text-xs gap-1 px-2 text-muted-foreground hover:text-destructive"
                                  aria-label="Remove from waitlist"
                                >
                                  {removingId === entry.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                  {removingId === entry.id ? "..." : "Remove"}
                                </Button>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </AnimatePresence>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add to Waitlist Dialog */}
      <AddWaitlistDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        services={services}
        staff={staff}
        clients={clients}
      />
    </>
  )
}
