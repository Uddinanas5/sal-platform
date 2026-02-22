"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  DollarSign,
  Calendar,
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
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/reports/date-range-picker"
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
      iconColor: "text-sal-600",
    },
    {
      title: "Appointments",
      value: summary.totalAppointments.toString(),
      growth: summary.appointmentGrowth,
      icon: Calendar,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Avg Ticket",
      value: formatCurrency(summary.averageTicket),
      growth: summary.ticketGrowth,
      icon: Receipt,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "New Clients",
      value: summary.newClients.toString(),
      growth: summary.clientGrowth,
      icon: UserPlus,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ]

  function handleExportCSV() {
    exportToCsv(
      `sal-report-${new Date().toISOString().split("T")[0]}`,
      ["Metric", "Value", "Growth"],
      summaryCards.map((c) => [c.title, c.value, `${c.growth}%`])
    )
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
            <DateRangePicker />
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
                <Card className="border-cream-200">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                        <p className="text-2xl font-heading font-bold text-foreground">
                          {card.value}
                        </p>
                        <div className="flex items-center gap-1">
                          {isPositive ? (
                            <TrendingUp className="w-3.5 h-3.5 text-sal-500" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isPositive ? "text-sal-600" : "text-red-600"
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
