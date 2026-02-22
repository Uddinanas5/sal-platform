"use client"

import React, { useState, useMemo, useCallback, useEffect } from "react"
import { addDays, subDays, addMonths, subMonths, startOfDay, isSameDay } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/lib/actions/appointments"
import { Plus, ChevronLeft, ChevronRight, ListChecks } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, cn } from "@/lib/utils"
import { CalendarHeader, type CalendarView } from "@/components/calendar/calendar-header"
import { DayView } from "@/components/calendar/day-view"
import { ThreeDayView } from "@/components/calendar/three-day-view"
import { WeekView } from "@/components/calendar/week-view"
import { MonthView } from "@/components/calendar/month-view"
import { NewAppointmentDialog } from "@/components/calendar/new-appointment-dialog"
import { AppointmentDetailSheet } from "@/components/calendar/appointment-detail-sheet"
import { WaitlistPanel } from "@/components/calendar/waitlist-panel"
import type { ColorByMode } from "@/components/calendar/appointment-block"
import type { Appointment } from "@/data/mock-data"

interface WaitlistEntryData {
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

interface CalendarClientProps {
  initialAppointments: Appointment[]
  staff: Array<{
    id: string; name: string; email: string; phone: string; avatar?: string;
    role: "admin" | "manager" | "staff"; services: string[];
    workingHours: Record<string, { start: string; end: string } | null>;
    color: string; isActive: boolean;
  }>
  services: Array<{
    id: string; name: string; description: string; duration: number;
    price: number; category: string; color: string; isActive: boolean;
  }>
  clients: Array<{
    id: string; name: string; email: string; phone: string;
    totalVisits: number; totalSpent: number;
  }>
  waitlistEntries?: WaitlistEntryData[]
}

// Read a localStorage value with fallback
function readPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const v = localStorage.getItem(`sal-calendar-${key}`)
    return v !== null ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

// Hook to detect mobile viewport
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [breakpoint])
  return isMobile
}

export function CalendarClient(props: CalendarClientProps) {
  const isMobile = useIsMobile()
  const router = useRouter()

  // Core state — persisted preferences restored from localStorage
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [view, setView] = useState<CalendarView>(() => readPref<CalendarView>("view", "day"))
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
  const [colorBy, setColorBy] = useState<ColorByMode>(() => readPref<ColorByMode>("colorBy", "staff"))
  const [zoom, setZoom] = useState(() => readPref<number>("zoom", 1))
  const [showWorkingHours, setShowWorkingHours] = useState(() => readPref<boolean>("showWorkingHours", false))

  // Mobile: track which single staff member to show
  const [mobileStaffIndex, setMobileStaffIndex] = useState(0)

  // Persist preferences to localStorage on change
  useEffect(() => { localStorage.setItem("sal-calendar-view", JSON.stringify(view)) }, [view])
  useEffect(() => { localStorage.setItem("sal-calendar-colorBy", JSON.stringify(colorBy)) }, [colorBy])
  useEffect(() => { localStorage.setItem("sal-calendar-zoom", JSON.stringify(zoom)) }, [zoom])
  useEffect(() => { localStorage.setItem("sal-calendar-showWorkingHours", JSON.stringify(showWorkingHours)) }, [showWorkingHours])

  // Dialog / sheet state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newApptOpen, setNewApptOpen] = useState(false)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)

  // Pre-fill state for new appointment
  const [newApptInitialStaffId, setNewApptInitialStaffId] = useState<string | undefined>()
  const [newApptInitialDate, setNewApptInitialDate] = useState<Date | undefined>()
  const [newApptInitialHour, setNewApptInitialHour] = useState<number | undefined>()
  const [newApptInitialMinute, setNewApptInitialMinute] = useState<number | undefined>()

  // Appointments state — rehydrate dates from server-serialized ISO strings
  const [appointments, setAppointments] = useState<Appointment[]>(() =>
    props.initialAppointments.map(a => ({
      ...a,
      startTime: new Date(a.startTime),
      endTime: new Date(a.endTime),
    }))
  )

  // Status filter
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())

  // Filtered appointments based on status
  const filteredAppointments = useMemo(() => {
    if (statusFilter.size === 0) return appointments
    return appointments.filter((a) => statusFilter.has(a.status))
  }, [statusFilter, appointments])

  // Filtered staff based on dropdown
  const activeStaff = useMemo(() => {
    const active = props.staff.filter((s) => s.isActive)
    if (selectedStaffId === "all") return active
    return active.filter((s) => s.id === selectedStaffId)
  }, [selectedStaffId, props.staff])

  // On mobile, show one staff at a time (for day/3day views)
  const showMobileStaffNav = isMobile && activeStaff.length > 1 && (view === "day" || view === "3day")
  const mobileStaff = useMemo(() => {
    if (!showMobileStaffNav) return activeStaff
    const idx = Math.min(mobileStaffIndex, activeStaff.length - 1)
    return [activeStaff[idx]]
  }, [showMobileStaffNav, activeStaff, mobileStaffIndex])

  // Reset mobile staff index when staff list changes
  useEffect(() => {
    setMobileStaffIndex(0)
  }, [selectedStaffId])

  // Day stats for header subtitle
  const dayStats = useMemo(() => {
    const dayAppts = appointments.filter((a) =>
      isSameDay(a.startTime, selectedDate)
    )
    const totalRevenue = dayAppts.reduce((sum, a) => sum + a.price, 0)
    return { count: dayAppts.length, revenue: totalRevenue }
  }, [selectedDate, appointments])

  // Navigation handlers
  const handleToday = useCallback(() => {
    setSelectedDate(startOfDay(new Date()))
  }, [])

  const handlePrev = useCallback(() => {
    setSelectedDate((prev) => {
      if (view === "day") return subDays(prev, 1)
      if (view === "3day") return subDays(prev, 3)
      if (view === "month") return subMonths(prev, 1)
      return subDays(prev, 7)
    })
  }, [view])

  const handleNext = useCallback(() => {
    setSelectedDate((prev) => {
      if (view === "day") return addDays(prev, 1)
      if (view === "3day") return addDays(prev, 3)
      if (view === "month") return addMonths(prev, 1)
      return addDays(prev, 7)
    })
  }, [view])

  // Keyboard navigation: arrow keys, T for today
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      if (isInput || e.metaKey || e.ctrlKey) return

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        handlePrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        handleNext()
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault()
        handleToday()
      }
    }
    document.addEventListener("keydown", handleKeydown)
    return () => document.removeEventListener("keydown", handleKeydown)
  }, [handlePrev, handleNext, handleToday])

  // Month view day click handler - switches to day view
  const handleMonthDayClick = useCallback((date: Date) => {
    setSelectedDate(date)
    setView("day")
  }, [])

  // Appointment click handler
  const handleAppointmentClick = useCallback((appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setDetailSheetOpen(true)
  }, [])
  // Status change handler — optimistic UI + server action
  const handleStatusChange = useCallback(async (appointmentId: string, newStatus: string) => {
    // Optimistic update: apply immediately for responsive UI
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === appointmentId ? { ...a, status: newStatus as Appointment["status"] } : a
      )
    )
    // Also update the selected appointment so the sheet reflects the change
    setSelectedAppointment((prev) =>
      prev && prev.id === appointmentId
        ? { ...prev, status: newStatus as Appointment["status"] }
        : prev
    )

    const result = await updateAppointmentStatus(appointmentId, newStatus)
    if (!result.success) {
      toast.error(result.error || "Failed to update appointment status")
    } else {
      router.refresh()
    }
  }, [router])

  // Empty slot click handler - opens new appointment dialog
  const handleEmptySlotClick = useCallback(
    (staffId: string, date: Date, hour: number, minute: number) => {
      setNewApptInitialStaffId(staffId)
      setNewApptInitialDate(date)
      setNewApptInitialHour(hour)
      setNewApptInitialMinute(minute)
      setNewApptOpen(true)
    },
    []
  )

  // New appointment button handler (no pre-fill)
  const handleNewAppointment = useCallback(() => {
    setNewApptInitialStaffId(undefined)
    setNewApptInitialDate(selectedDate)
    setNewApptInitialHour(undefined)
    setNewApptInitialMinute(undefined)
    setNewApptOpen(true)
  }, [selectedDate])

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header
        title="Calendar"
        subtitle={`${dayStats.count} appointments · ${formatCurrency(dayStats.revenue)} revenue today`}
      />

      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Calendar header with controls */}
        <Card className="overflow-hidden border-cream-200 shadow-sm">
          <CalendarHeader
            currentDate={selectedDate}
            view={view}
            onDateChange={setSelectedDate}
            onViewChange={setView}
            onTodayClick={handleToday}
            onPrev={handlePrev}
            onNext={handleNext}
            onNewAppointment={handleNewAppointment}
            onSettingsClick={() => setSettingsOpen(true)}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={setSettingsOpen}
            colorBy={colorBy}
            onColorByChange={setColorBy}
            zoom={zoom}
            onZoomChange={setZoom}
            showWorkingHours={showWorkingHours}
            onShowWorkingHoursChange={setShowWorkingHours}
            staff={props.staff}
            selectedStaffId={selectedStaffId}
            onStaffFilterChange={setSelectedStaffId}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
          {/* Waitlist quick-access bar */}
          <div className="flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2 bg-cream-50 dark:bg-muted/30 border-t border-cream-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWaitlistOpen(true)}
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ListChecks className="h-3.5 w-3.5" />
              Waitlist
              {(props.waitlistEntries?.length ?? 0) > 0 && (
                <span className="bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-semibold">
                  {props.waitlistEntries?.length}
                </span>
              )}
            </Button>
          </div>
        </Card>

        {/* Calendar grid */}
        <Card className="flex-1 overflow-hidden border-cream-200 shadow-sm flex flex-col min-h-[600px]">
          {/* Mobile staff navigation - shown when multiple staff on small screens */}
          {showMobileStaffNav && (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-cream-50 border-b border-cream-200 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={mobileStaffIndex === 0}
                onClick={() => setMobileStaffIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 overflow-x-auto flex gap-1 scrollbar-none">
                {activeStaff.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setMobileStaffIndex(i)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-all",
                      mobileStaffIndex === i
                        ? "bg-card text-foreground shadow-sm border border-cream-200"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div
                      className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.name.charAt(0)}
                    </div>
                    <span className="truncate max-w-[80px]">{s.name.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={mobileStaffIndex >= activeStaff.length - 1}
                onClick={() => setMobileStaffIndex((i) => Math.min(activeStaff.length - 1, i + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col h-full"
            >
              {view === "day" && (
                <DayView
                  date={selectedDate}
                  staff={mobileStaff}
                  appointments={filteredAppointments}
                  services={props.services}
                  colorBy={colorBy}
                  zoom={zoom}
                  onAppointmentClick={handleAppointmentClick}
                  onEmptySlotClick={handleEmptySlotClick}
                  showWorkingHours={showWorkingHours}
                />
              )}

              {view === "3day" && (
                <ThreeDayView
                  date={selectedDate}
                  staff={mobileStaff}
                  appointments={filteredAppointments}
                  services={props.services}
                  colorBy={colorBy}
                  zoom={zoom}
                  onAppointmentClick={handleAppointmentClick}
                  onEmptySlotClick={handleEmptySlotClick}
                  showWorkingHours={showWorkingHours}
                />
              )}

              {view === "week" && (
                <WeekView
                  date={selectedDate}
                  staff={activeStaff}
                  appointments={filteredAppointments}
                  services={props.services}
                  colorBy={colorBy}
                  zoom={zoom}
                  onAppointmentClick={handleAppointmentClick}
                  onEmptySlotClick={handleEmptySlotClick}
                  showWorkingHours={showWorkingHours}
                />
              )}

              {view === "month" && (
                <MonthView
                  date={selectedDate}
                  appointments={filteredAppointments}
                  staff={activeStaff}
                  services={props.services}
                  colorBy={colorBy}
                  onDayClick={handleMonthDayClick}
                  onAppointmentClick={handleAppointmentClick}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </Card>

      </div>

      {/* New Appointment Dialog */}
      <NewAppointmentDialog
        open={newApptOpen}
        onOpenChange={setNewApptOpen}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clients={props.clients as any}
        services={props.services}
        staff={props.staff}
        appointments={appointments}
        initialDate={newApptInitialDate}
        initialStaffId={newApptInitialStaffId}
        initialHour={newApptInitialHour}
        initialMinute={newApptInitialMinute}
      />

      {/* Appointment Detail Sheet */}
      <AppointmentDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        appointment={selectedAppointment}
        staffList={props.staff}
        serviceList={props.services}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clientList={props.clients as any}
        onStatusChange={handleStatusChange}
      />

      {/* Waitlist Panel */}
      <WaitlistPanel
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        entries={props.waitlistEntries ?? []}
        services={props.services}
        staff={props.staff}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clients={props.clients as any}
      />

      {/* Mobile FAB for new appointment */}
      <Button
        onClick={handleNewAppointment}
        className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg shadow-sal-500/30"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  )
}
