"use client"

import React from "react"
import { motion } from "framer-motion"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, DollarSign, TrendingUp, ShoppingBag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { formatCurrency, formatDate } from "@/lib/utils"
import { type Client } from "@/data/mock-data"

interface ClientPurchasesTabProps {
  client: Client
}

interface PurchaseRow {
  id: string
  date: Date
  items: string[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
  staff: string
}

const columns: ColumnDef<PurchaseRow>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium text-sm">{formatDate(row.getValue("date") as Date)}</span>
    ),
    sortingFn: "datetime",
  },
  {
    accessorKey: "items",
    header: "Items",
    cell: ({ row }) => {
      const items = row.getValue("items") as string[]
      return (
        <div className="space-y-0.5">
          {items.map((item, i) => (
            <p key={i} className="text-sm">{item}</p>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: "subtotal",
    header: "Subtotal",
    cell: ({ row }) => (
      <span className="text-sm">{formatCurrency(row.getValue("subtotal"))}</span>
    ),
  },
  {
    accessorKey: "discount",
    header: "Discount",
    cell: ({ row }) => {
      const discount = row.getValue("discount") as number
      return discount > 0 ? (
        <span className="text-sm text-red-500">-{formatCurrency(discount)}</span>
      ) : (
        <span className="text-sm text-muted-foreground/70">--</span>
      )
    },
  },
  {
    accessorKey: "tax",
    header: "Tax",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{formatCurrency(row.getValue("tax"))}</span>
    ),
  },
  {
    accessorKey: "total",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Total
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-semibold text-sm text-sal-600">
        {formatCurrency(row.getValue("total"))}
      </span>
    ),
  },
  {
    accessorKey: "paymentMethod",
    header: "Payment",
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {row.getValue("paymentMethod")}
      </Badge>
    ),
  },
  {
    accessorKey: "staff",
    header: "Staff",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.getValue("staff")}</span>
    ),
  },
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ClientPurchasesTab({ client }: ClientPurchasesTabProps) {
  const purchases: PurchaseRow[] = []

  const totalSpent = purchases.reduce((sum, p) => sum + p.total, 0)
  const averageTicket = purchases.length > 0 ? totalSpent / purchases.length : 0
  const lastPurchase = purchases.length > 0
    ? purchases.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date
    : null

  const stats = [
    { label: "Total Spent", value: formatCurrency(totalSpent), icon: DollarSign },
    { label: "Average Ticket", value: formatCurrency(averageTicket), icon: TrendingUp },
    { label: "Last Purchase", value: lastPurchase ? formatDate(lastPurchase) : "N/A", icon: ShoppingBag },
  ]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-cream-200">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-sal-100">
                  <stat.icon className="w-5 h-5 text-sal-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-heading font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Purchases Table */}
      <DataTable
        columns={columns}
        data={purchases}
        pageSize={8}
        showColumnToggle
      />
    </div>
  )
}
