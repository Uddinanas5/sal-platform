"use client"

import React, { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  Gift,
  DollarSign,
  Plus,
  Search,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn, formatCurrency, getStatusColor } from "@/lib/utils"
import { EmptyState } from "@/components/shared/empty-state"
import { IssueGiftCardDialog } from "./issue-gift-card-dialog"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import type { GiftCard } from "@/data/mock-memberships"

interface ClientOption {
  id: string
  name: string
}

interface GiftCardsTabProps {
  giftCards?: GiftCard[]
  stats?: {
    totalGiftCardsSold: number
    outstandingGiftCardBalance: number
  }
  clients?: ClientOption[]
}

const columnHelper = createColumnHelper<GiftCard>()

export function GiftCardsTab({ giftCards = [], stats = { totalGiftCardsSold: 0, outstandingGiftCardBalance: 0 }, clients = [] }: GiftCardsTabProps) {
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns = useMemo(
    () => [
      columnHelper.accessor("code", {
        header: "Code",
        cell: (info) => (
          <span className="font-mono font-semibold text-sm text-foreground">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("initialBalance", {
        header: "Initial Balance",
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {formatCurrency(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("currentBalance", {
        header: "Current Balance",
        cell: (info) => {
          const current = info.getValue()
          const initial = info.row.original.initialBalance
          const percent = initial > 0 ? (current / initial) * 100 : 0

          return (
            <div className="space-y-1.5 min-w-[120px]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(current)}
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  {Math.round(percent)}%
                </span>
              </div>
              <Progress value={percent} className="h-1.5" />
            </div>
          )
        },
      }),
      columnHelper.accessor("purchasedBy", {
        header: "Purchased By",
        cell: (info) => (
          <span className="text-sm text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("recipientName", {
        header: "Recipient",
        cell: (info) => {
          const name = info.getValue()
          const email = info.row.original.recipientEmail
          return (
            <span className="text-sm text-muted-foreground">
              {name || email || "--"}
            </span>
          )
        },
      }),
      columnHelper.accessor("purchaseDate", {
        header: "Purchase Date",
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {info.getValue().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ),
      }),
      columnHelper.accessor("expiryDate", {
        header: "Expiry",
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {info.getValue().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue()
          return (
            <Badge className={cn(getStatusColor(status), "capitalize")}>
              {status}
            </Badge>
          )
        },
      }),
    ],
    []
  )

  const table = useReactTable({
    data: giftCards,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const searchValue =
    (table.getColumn("code")?.getFilterValue() as string) ?? ""

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            label: "Total Sold",
            value: stats.totalGiftCardsSold,
            icon: Gift,
            iconBg: "bg-purple-500/10",
            iconColor: "text-purple-600",
          },
          {
            label: "Outstanding Balance",
            value: formatCurrency(stats.outstandingGiftCardBalance),
            icon: DollarSign,
            iconBg: "bg-emerald-500/10",
            iconColor: "text-emerald-600",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-heading font-bold text-foreground mt-1">
                      {stat.value}
                    </p>
                  </div>
                  <div className={cn("p-2.5 rounded-xl", stat.iconBg)}>
                    <stat.icon className={cn("w-5 h-5", stat.iconColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Gift Cards Table */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-semibold text-foreground">
          Gift Cards
        </h3>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
            <Input
              placeholder="Search by code..."
              value={searchValue}
              onChange={(e) =>
                table.getColumn("code")?.setFilterValue(e.target.value)
              }
              className="pl-9"
            />
          </div>
          <Button onClick={() => setIsIssueDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Issue Gift Card
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-cream-200"
                  >
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-cream-100 last:border-0 hover:bg-cream-50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3 whitespace-nowrap"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.getRowModel().rows.length === 0 && (
            <EmptyState
              icon={<Gift className="w-7 h-7 text-sal-600" />}
              title="No gift cards found"
              description="Issue gift cards to clients for a convenient payment option."
            />
          )}
        </CardContent>
      </Card>

      <IssueGiftCardDialog
        clients={clients}
        open={isIssueDialogOpen}
        onOpenChange={setIsIssueDialogOpen}
      />
    </div>
  )
}
