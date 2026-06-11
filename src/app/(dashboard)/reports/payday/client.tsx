"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  format as formatDate,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns"
import {
  DollarSign,
  Users,
  Scissors,
  Download,
  Printer,
  ChevronDown,
  Info,
  ArrowLeft,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { cn, formatCurrency, exportToCsv } from "@/lib/utils"
import type { PayrollStatement } from "@/lib/queries/payroll"

interface PeriodOption {
  id: string
  periodStart: string
  periodEnd: string
  status: "open" | "closed" | "paid"
  paidAt: string | null
}

interface PaydayClientProps {
  statement: PayrollStatement
  periods: PeriodOption[]
  selectedPeriodId: string | null
}

const dayKey = (d: Date) => formatDate(d, "yyyy-MM-dd")
const fmtDay = (iso: string) => formatDate(new Date(iso), "MMM d, yyyy")
const fmtDayTime = (iso: string) => formatDate(new Date(iso), "MMM d, h:mm a")

const employmentLabel: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contractor: "Contractor",
}

// ---------------------------------------------------------------------------
// Period / range control. Selecting a stored payroll period OR a custom range
// navigates (URL search params) so the server re-runs the statement query.
// ---------------------------------------------------------------------------
function PeriodPicker({
  periods,
  selectedPeriodId,
}: {
  periods: PeriodOption[]
  selectedPeriodId: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")

  const [customStart, setCustomStart] = React.useState<Date | undefined>(
    fromParam ? new Date(fromParam) : undefined,
  )
  const [customEnd, setCustomEnd] = React.useState<Date | undefined>(
    toParam ? new Date(toParam) : undefined,
  )

  const selectPeriod = (value: string) => {
    if (value === "__custom__") {
      // Default a custom range to last month when switching in.
      const lm = subMonths(new Date(), 1)
      const from = startOfMonth(lm)
      const to = endOfMonth(lm)
      setCustomStart(from)
      setCustomEnd(to)
      router.push(`?from=${dayKey(from)}&to=${dayKey(to)}`)
      return
    }
    router.push(`?period=${encodeURIComponent(value)}`)
  }

  const applyCustom = (start?: Date, end?: Date) => {
    if (start && end && start <= end) {
      router.push(`?from=${dayKey(start)}&to=${dayKey(end)}`)
    }
  }

  const usingCustom = !selectedPeriodId && (!!fromParam || !!toParam)
  const selectValue = selectedPeriodId ?? (usingCustom ? "__custom__" : "")

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectValue} onValueChange={selectPeriod}>
        <SelectTrigger className="h-9 w-[260px] border-cream-200 bg-card">
          <SelectValue placeholder="Choose a pay period" />
        </SelectTrigger>
        <SelectContent>
          {periods.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {fmtDay(p.periodStart)} – {fmtDay(p.periodEnd)}
              {p.status !== "open" ? `  (${p.status})` : ""}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">Custom date range…</SelectItem>
        </SelectContent>
      </Select>

      {usingCustom && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 border-cream-200">
              {customStart && customEnd
                ? `${customStart.toLocaleDateString()} – ${customEnd.toLocaleDateString()}`
                : "Select range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="end">
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm font-medium text-foreground">Start Date</p>
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
                <p className="mb-1 text-sm font-medium text-foreground">End Date</p>
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

function StatusBadge({ status }: { status: PeriodOption["status"] | "pending" | "approved" | "paid" }) {
  const map: Record<string, string> = {
    open: "bg-blue-500/10 text-blue-300",
    closed: "bg-amber-500/10 text-amber-300",
    paid: "bg-emerald-500/10 text-emerald-300",
    pending: "bg-amber-500/10 text-amber-300",
    approved: "bg-blue-500/10 text-blue-300",
  }
  return (
    <Badge className={cn("border-0 font-medium capitalize", map[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </Badge>
  )
}

function BarberCard({
  barber,
}: {
  barber: PayrollStatement["barbers"][number]
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Card className="overflow-hidden border-cream-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-cream-100"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sal-500/10 text-sm font-semibold text-sal-300">
            {barber.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{barber.name}</p>
            <p className="text-xs text-muted-foreground">
              {employmentLabel[barber.employmentType] ?? barber.employmentType}
              {" · "}
              {barber.defaultCommissionRate}% default rate
              {" · "}
              {barber.commissionedServices}{" "}
              {barber.commissionedServices === 1 ? "service" : "services"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">To pay</p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(barber.totalToPay)}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open && (
        <CardContent className="border-t border-cream-200 bg-cream-50 p-0">
          {barber.lineItems.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              No commissioned services in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Date</th>
                    <th className="px-5 py-2 font-medium">Service</th>
                    <th className="px-5 py-2 font-medium">Client</th>
                    <th className="px-5 py-2 text-right font-medium">Gross</th>
                    <th className="px-5 py-2 text-right font-medium">Rate</th>
                    <th className="px-5 py-2 text-right font-medium">Commission</th>
                    <th className="px-5 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {barber.lineItems.map((li) => (
                    <tr key={li.commissionId} className="border-b border-cream-200 last:border-0">
                      <td className="whitespace-nowrap px-5 py-2 text-muted-foreground">
                        {fmtDayTime(li.date)}
                      </td>
                      <td className="px-5 py-2 text-foreground">
                        {li.description}
                        {li.bookingReference && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            #{li.bookingReference}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2 text-muted-foreground">
                        {li.clientName ?? "—"}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-foreground">
                        {formatCurrency(li.grossAmount)}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-muted-foreground">
                        {li.commissionRate}%
                      </td>
                      <td className="px-5 py-2 text-right font-semibold tabular-nums text-foreground">
                        {formatCurrency(li.commissionAmount)}
                      </td>
                      <td className="px-5 py-2">
                        <StatusBadge status={li.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-cream-100 font-semibold text-foreground">
                    <td className="px-5 py-2.5" colSpan={3}>
                      Subtotal — {barber.name}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {formatCurrency(barber.grossServiceRevenue)}
                    </td>
                    <td />
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {formatCurrency(barber.commissionEarned)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function PaydayClient({ statement, periods, selectedPeriodId }: PaydayClientProps) {
  const { barbers, totals, range, notTracked } = statement

  const periodLabel = `${fmtDay(range.from)} – ${fmtDay(range.to)}`

  // REAL CSV export of the full statement: one header row, every line item from
  // every barber, with barber name + employment context on each row so the file
  // stands alone in a spreadsheet. Plus per-barber subtotal rows and a grand
  // total. No fabricated tip/booth-rent columns.
  function handleExportCsv() {
    if (barbers.length === 0) {
      toast.info("Nothing to export", { description: "No commissions in this period." })
      return
    }
    const headers = [
      "Barber",
      "Employment Type",
      "Default Rate %",
      "Date",
      "Type",
      "Service / Description",
      "Booking Ref",
      "Client",
      "Gross",
      "Commission Rate %",
      "Commission Earned",
      "Status",
    ]
    const rows: string[][] = []
    for (const b of barbers) {
      for (const li of b.lineItems) {
        rows.push([
          b.name,
          employmentLabel[b.employmentType] ?? b.employmentType,
          String(b.defaultCommissionRate),
          fmtDayTime(li.date),
          li.type,
          li.description,
          li.bookingReference ?? "",
          li.clientName ?? "",
          li.grossAmount.toFixed(2),
          String(li.commissionRate),
          li.commissionAmount.toFixed(2),
          li.status,
        ])
      }
      // Per-barber subtotal row.
      rows.push([
        b.name,
        "",
        "",
        "",
        "",
        `SUBTOTAL (${b.commissionedServices} services)`,
        "",
        "",
        b.grossServiceRevenue.toFixed(2),
        "",
        b.commissionEarned.toFixed(2),
        "to pay: " + b.totalToPay.toFixed(2),
      ])
    }
    // Grand total row.
    rows.push([
      "ALL BARBERS",
      "",
      "",
      "",
      "",
      `TOTAL (${totals.commissionedServices} services)`,
      "",
      "",
      totals.grossServiceRevenue.toFixed(2),
      "",
      totals.commissionEarned.toFixed(2),
      "to pay: " + totals.totalToPay.toFixed(2),
    ])

    const filename = `payday-statement-${dayKey(new Date(range.from))}-to-${dayKey(new Date(range.to))}`
    exportToCsv(filename, headers, rows)
    toast.success("Payday statement exported as CSV")
  }

  function handlePrint() {
    toast.info("Print / PDF", { description: "Opening the print dialog…" })
    setTimeout(() => window.print(), 400)
  }

  const summaryCards = [
    {
      title: "Total to pay",
      value: formatCurrency(totals.totalToPay),
      icon: Wallet,
      tone: "text-emerald-400",
    },
    {
      title: "Barbers paid",
      value: String(totals.barberCount),
      icon: Users,
      tone: "text-sal-400",
    },
    {
      title: "Commissioned services",
      value: String(totals.commissionedServices),
      icon: Scissors,
      tone: "text-blue-400",
    },
    {
      title: "Gross service revenue",
      value: formatCurrency(totals.grossServiceRevenue),
      icon: DollarSign,
      tone: "text-amber-400",
    },
  ]

  return (
    <div className="min-h-screen bg-cream print:bg-white">
      <div className="print:hidden">
        <Header title="Payday Statement" subtitle="Per-barber commission earnings for the period" />
      </div>

      <div className="space-y-6 p-6 print:p-0">
        {/* Header / controls */}
        <div className="flex flex-col gap-4 print:hidden lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <Link
              href="/reports"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to reports
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Payday</h1>
            <p className="text-sm text-muted-foreground">Pay period: {periodLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker periods={periods} selectedPeriodId={selectedPeriodId} />
            <Button variant="outline" size="sm" className="h-9 gap-2 border-cream-200" onClick={handleExportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-2 border-cream-200" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
          </div>
        </div>

        {/* Print-only title block */}
        <div className="hidden print:block">
          <h1 className="text-xl font-bold">Payday Statement</h1>
          <p className="text-sm text-gray-600">Pay period: {periodLabel}</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summaryCards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="border-cream-200">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
                  </div>
                  <card.icon className={cn("h-8 w-8", card.tone)} />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Honest "not yet tracked" notice — never fabricate tips / booth rent. */}
        {(notTracked.tips || notTracked.boothRent) && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Not yet tracked in these totals</p>
              <p className="mt-0.5 text-amber-300/90">
                {notTracked.tips && "Tips are recorded at the sale level but aren't attributed to an individual barber yet. "}
                {notTracked.boothRent && "Booth rent isn't modeled in the system yet. "}
                These are deliberately excluded so the &ldquo;to pay&rdquo; figure reflects only real, recorded commission — not an estimate.
              </p>
            </div>
          </div>
        )}

        {/* Per-barber statements */}
        {barbers.length === 0 ? (
          <Card className="border-cream-200">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-foreground">No commissions in this period</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Once checkouts ring up commissioned services in this window, each barber&rsquo;s statement will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {barbers.map((barber) => (
              <BarberCard key={barber.staffId} barber={barber} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
