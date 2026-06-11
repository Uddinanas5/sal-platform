"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  format as formatDate,
} from "date-fns"
import {
  DollarSign,
  Calendar,
  CalendarDays,
  Receipt,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  FileSpreadsheet,
} from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePicker } from "@/components/ui/date-picker"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { RevenueTab } from "@/components/reports/revenue-tab"
import { AppointmentsTab } from "@/components/reports/appointments-tab"
import { StaffTab } from "@/components/reports/staff-tab"
import { ClientsTab } from "@/components/reports/clients-tab"
import { cn, formatCurrency, exportToCsv } from "@/lib/utils"

interface ReportSummary {
  totalRevenue: number
  revenueGrowth: number
  totalAppointments: number
  appointmentGrowth: number
  averageTicket: number
  ticketGrowth: number
  newClients: number
  clientGrowth: number
  retentionRate: number
  productRevenue: number
  serviceRevenue: number
}

interface RevenueByMonthItem {
  month: string
  revenue: number
}

interface NameValueColor {
  name: string
  value: number
  color: string
}

interface StaffPerformanceItem {
  name: string
  appointments: number
  revenue: number
  rating: number
  commission: number
}

interface AppointmentByHourItem {
  hour: string
  count: number
}

interface AppointmentCompletionRate {
  completed: number
  cancelled: number
  noShow: number
  rescheduled: number
}

interface HeatmapRow {
  day: string
  hours: number[]
}

interface ClientRetentionItem {
  month: string
  newClients: number
  returning: number
}

interface TopClientItem {
  name: string
  visits: number
  spent: number
  lastVisit: string
}

interface ReportsClientProps {
  summary: ReportSummary
  revenueByMonth: RevenueByMonthItem[]
  revenueByCategory: NameValueColor[]
  revenueByPaymentMethod: NameValueColor[]
  staffPerformance: StaffPerformanceItem[]
  appointmentsByHour: AppointmentByHourItem[]
  appointmentCompletionRate: AppointmentCompletionRate
  busiestTimesHeatmap: HeatmapRow[]
  clientRetention: ClientRetentionItem[]
  topClients: TopClientItem[]
  clientAcquisitionSources: NameValueColor[]
}

// ---------------------------------------------------------------------------
// Date-range control wired to URL search params (?from=YYYY-MM-DD&to=YYYY-MM-DD).
// Replaces the old dead local-state picker — selecting a preset/custom range now
// navigates, which re-runs the server queries against that window.
// ---------------------------------------------------------------------------
const dayKey = (d: Date) => formatDate(d, "yyyy-MM-dd")

const presets = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this-week" },
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "Custom", value: "custom" },
] as const
type PresetValue = (typeof presets)[number]["value"]

function presetRange(value: Exclude<PresetValue, "custom">): { from: Date; to: Date } {
  const now = new Date()
  switch (value) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) }
    case "this-week":
      return { from: startOfWeek(now), to: endOfWeek(now) }
    case "last-month": {
      const lm = subMonths(now, 1)
      return { from: startOfMonth(lm), to: endOfMonth(lm) }
    }
    case "this-month":
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) }
  }
}

function ReportsDateRangePicker({ className }: { className?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")

  // Derive the active preset from the URL so it survives reload/back/forward.
  const activePreset: PresetValue = React.useMemo(() => {
    if (!fromParam || !toParam) return "this-month"
    for (const p of presets) {
      if (p.value === "custom") continue
      const r = presetRange(p.value)
      if (dayKey(r.from) === fromParam && dayKey(r.to) === toParam) return p.value
    }
    return "custom"
  }, [fromParam, toParam])

  const [showCustom, setShowCustom] = React.useState(activePreset === "custom")
  const [customStart, setCustomStart] = React.useState<Date | undefined>(
    fromParam ? new Date(fromParam) : undefined
  )
  const [customEnd, setCustomEnd] = React.useState<Date | undefined>(
    toParam ? new Date(toParam) : undefined
  )

  const pushRange = (from: Date, to: Date) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set("from", dayKey(from))
    params.set("to", dayKey(to))
    router.push(`?${params.toString()}`)
  }

  const handlePresetClick = (value: PresetValue) => {
    if (value === "custom") {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    const r = presetRange(value)
    pushRange(r.from, r.to)
  }

  const applyCustom = (start?: Date, end?: Date) => {
    if (start && end && start <= end) pushRange(start, end)
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center rounded-lg border border-cream-200 bg-white/[0.04] p-1 overflow-x-auto">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm font-medium rounded-md transition-all shrink-0",
              activePreset === preset.value
                ? "bg-sal-500 text-white hover:bg-sal-600 hover:text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-cream-100"
            )}
            onClick={() => handlePresetClick(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {showCustom && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2 border-cream-200">
              <CalendarDays className="h-4 w-4" />
              {customStart && customEnd
                ? `${customStart.toLocaleDateString()} - ${customEnd.toLocaleDateString()}`
                : "Select range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="end">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Start Date</p>
                <DatePicker
                  date={customStart}
                  onSelect={(d) => {
                    setCustomStart(d)
                    applyCustom(d, customEnd)
                  }}
                  placeholder="Start date"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">End Date</p>
                <DatePicker
                  date={customEnd}
                  onSelect={(d) => {
                    setCustomEnd(d)
                    applyCustom(customStart, d)
                  }}
                  placeholder="End date"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

export function ReportsClient(props: ReportsClientProps) {
  const {
    summary,
    revenueByMonth,
    revenueByCategory,
    revenueByPaymentMethod,
    staffPerformance,
    appointmentsByHour,
    appointmentCompletionRate,
    busiestTimesHeatmap,
    clientRetention,
    topClients,
    clientAcquisitionSources,
  } = props

  const summaryCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(summary.totalRevenue),
      growth: summary.revenueGrowth,
      icon: DollarSign,
      iconBg: "bg-sal-100",
      iconColor: "text-mint",
    },
    {
      title: "Appointments",
      value: summary.totalAppointments.toString(),
      growth: summary.appointmentGrowth,
      icon: Calendar,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
    },
    {
      title: "Avg Ticket",
      value: formatCurrency(summary.averageTicket),
      growth: summary.ticketGrowth,
      icon: Receipt,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
    },
    {
      title: "New Clients",
      value: summary.newClients.toString(),
      growth: summary.clientGrowth,
      icon: UserPlus,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
    },
  ]

  function handleExportCSV() {
    // Dump the FULL dataset behind every tab — not just the 4 summary cards.
    // One CSV, multiple labelled sections. Rows are padded to the widest row so
    // columns line up in spreadsheet apps.
    const rows: string[][] = []
    const section = (title: string) => {
      if (rows.length) rows.push([])
      rows.push([title])
    }
    const header = (...cols: string[]) => rows.push(cols)
    const row = (...cells: (string | number)[]) => rows.push(cells.map((c) => String(c)))

    // Summary
    section("SUMMARY")
    header("Metric", "Value", "Growth %")
    row("Total Revenue", summary.totalRevenue, summary.revenueGrowth)
    row("Appointments", summary.totalAppointments, summary.appointmentGrowth)
    row("Avg Ticket", summary.averageTicket, summary.ticketGrowth)
    row("New Clients", summary.newClients, summary.clientGrowth)
    row("Retention Rate %", summary.retentionRate, "")
    row("Service Revenue", summary.serviceRevenue, "")
    row("Product Revenue", summary.productRevenue, "")

    // Revenue tab
    section("REVENUE BY MONTH")
    header("Month", "Revenue")
    revenueByMonth.forEach((m) => row(m.month, m.revenue))

    section("REVENUE BY CATEGORY")
    header("Category", "Revenue")
    revenueByCategory.forEach((c) => row(c.name, c.value))

    section("REVENUE BY PAYMENT METHOD")
    header("Method", "Amount")
    revenueByPaymentMethod.forEach((p) => row(p.name, p.value))

    // Appointments tab
    section("APPOINTMENTS BY HOUR")
    header("Hour", "Count")
    appointmentsByHour.forEach((a) => row(a.hour, a.count))

    section("APPOINTMENT COMPLETION RATE")
    header("Status", "Percent")
    row("Completed", appointmentCompletionRate.completed)
    row("Cancelled", appointmentCompletionRate.cancelled)
    row("No-show", appointmentCompletionRate.noShow)
    row("Rescheduled", appointmentCompletionRate.rescheduled)

    section("BUSIEST TIMES (count by hour 8AM-7PM)")
    header(
      "Day",
      "8AM", "9AM", "10AM", "11AM", "12PM", "1PM",
      "2PM", "3PM", "4PM", "5PM", "6PM", "7PM"
    )
    busiestTimesHeatmap.forEach((d) => row(d.day, ...d.hours))

    // Staff tab — full table incl. real ledger commission
    section("STAFF PERFORMANCE")
    header("Name", "Appointments", "Revenue", "Rating", "Commission")
    staffPerformance.forEach((s) =>
      row(s.name, s.appointments, s.revenue, s.rating, s.commission)
    )

    // Clients tab
    section("CLIENT RETENTION")
    header("Month", "New Clients", "Returning")
    clientRetention.forEach((c) => row(c.month, c.newClients, c.returning))

    section("TOP CLIENTS")
    header("Name", "Visits", "Spent", "Last Visit")
    topClients.forEach((c) => row(c.name, c.visits, c.spent, c.lastVisit))

    section("CLIENT ACQUISITION SOURCES")
    header("Source", "Percent")
    clientAcquisitionSources.forEach((c) => row(c.name, c.value))

    // Normalize width so the columns align.
    const width = rows.reduce((max, r) => Math.max(max, r.length), 0)
    const headers = Array.from({ length: width }, (_, i) => (i === 0 ? "SAL Report" : ""))
    const padded = rows.map((r) => {
      const copy = [...r]
      while (copy.length < width) copy.push("")
      return copy
    })

    exportToCsv(`sal-report-${new Date().toISOString().split("T")[0]}`, headers, padded)
    toast.success("Report exported as CSV")
  }

  function handleExportPDF() {
    toast.info("PDF export", { description: "Opening print dialog for PDF export..." })
    setTimeout(() => window.print(), 500)
  }

  return (
    <div className="min-h-screen bg-cream">
      <Header title="Reports" subtitle="Business analytics and insights" />

      <div className="p-6 space-y-6">
        {/* Page Header with DateRangePicker + Export */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Analytics Overview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Track your business performance and growth
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ReportsDateRangePicker />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card, index) => {
            const Icon = card.icon
            const isPositive = card.growth >= 0
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card variant="tile">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                        <p className="text-2xl font-heading font-bold text-foreground">
                          {card.value}
                        </p>
                        <div className="flex items-center gap-1">
                          {isPositive ? (
                            <TrendingUp className="w-3.5 h-3.5 text-mint-strong" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                          )}
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isPositive ? "text-mint" : "text-red-400"
                            )}
                          >
                            {isPositive ? "+" : ""}
                            {card.growth}%
                          </span>
                          <span className="text-xs text-muted-foreground/70">vs last month</span>
                        </div>
                      </div>
                      <div className={cn("p-3 rounded-xl", card.iconBg)}>
                        <Icon className={cn("w-5 h-5", card.iconColor)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Tabs defaultValue="revenue" className="space-y-6">
            <TabsList className="bg-cream-100 border border-cream-200 w-full sm:w-auto overflow-x-auto">
              <TabsTrigger
                value="revenue"
                className="data-[state=active]:bg-sal-500 data-[state=active]:text-white text-xs sm:text-sm"
              >
                Revenue
              </TabsTrigger>
              <TabsTrigger
                value="appointments"
                className="data-[state=active]:bg-sal-500 data-[state=active]:text-white text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">Appointments</span>
                <span className="sm:hidden">Appts</span>
              </TabsTrigger>
              <TabsTrigger
                value="staff"
                className="data-[state=active]:bg-sal-500 data-[state=active]:text-white text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">Staff Performance</span>
                <span className="sm:hidden">Staff</span>
              </TabsTrigger>
              <TabsTrigger
                value="clients"
                className="data-[state=active]:bg-sal-500 data-[state=active]:text-white text-xs sm:text-sm"
              >
                Clients
              </TabsTrigger>
            </TabsList>

            <TabsContent value="revenue">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <RevenueTab
                  summary={summary}
                  revenueByMonth={revenueByMonth}
                  revenueByCategory={revenueByCategory}
                  revenueByPaymentMethod={revenueByPaymentMethod}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="appointments">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <AppointmentsTab
                  appointmentsByHour={appointmentsByHour}
                  appointmentCompletionRate={appointmentCompletionRate}
                  busiestTimesHeatmap={busiestTimesHeatmap}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="staff">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <StaffTab staffPerformance={staffPerformance} />
              </motion.div>
            </TabsContent>

            <TabsContent value="clients">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <ClientsTab
                  clientRetention={clientRetention}
                  clientAcquisitionSources={clientAcquisitionSources}
                  topClients={topClients}
                  retentionRate={summary.retentionRate}
                />
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}
