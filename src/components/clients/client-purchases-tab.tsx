"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, DollarSign, TrendingUp, ShoppingBag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { formatCurrency, formatDate, TAX_RATE } from "@/lib/utils"
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

function generatePurchases(clientId: string): PurchaseRow[] {
  const purchaseData: Record<string, PurchaseRow[]> = {
    c1: [
      { id: "p1", date: new Date("2026-02-10"), items: ["Classic Haircut", "Blowout & Style"], subtotal: 80, discount: 0, tax: 6.40, total: 86.40, paymentMethod: "Credit Card", staff: "Alex Morgan" },
      { id: "p2", date: new Date("2026-01-28"), items: ["Color Treatment"], subtotal: 150, discount: 15, tax: 10.80, total: 145.80, paymentMethod: "Credit Card", staff: "Sarah Kim" },
      { id: "p3", date: new Date("2026-01-15"), items: ["Highlights", "Deep Tissue Massage"], subtotal: 215, discount: 0, tax: 17.20, total: 232.20, paymentMethod: "Debit Card", staff: "Alex Morgan" },
      { id: "p4", date: new Date("2026-01-02"), items: ["Keratin Treatment"], subtotal: 250, discount: 25, tax: 18.00, total: 243.00, paymentMethod: "Credit Card", staff: "Alex Morgan" },
      { id: "p5", date: new Date("2025-12-18"), items: ["Classic Haircut", "Beard Trim"], subtotal: 70, discount: 0, tax: 5.60, total: 75.60, paymentMethod: "Cash", staff: "Ryan Cooper" },
      { id: "p6", date: new Date("2025-12-05"), items: ["Facial Treatment"], subtotal: 85, discount: 0, tax: 6.80, total: 91.80, paymentMethod: "Credit Card", staff: "Jessica Lee" },
    ],
    c2: [
      { id: "p7", date: new Date("2026-02-08"), items: ["Beard Trim"], subtotal: 25, discount: 0, tax: 2.00, total: 27.00, paymentMethod: "Cash", staff: "Ryan Cooper" },
      { id: "p8", date: new Date("2026-01-20"), items: ["Classic Haircut"], subtotal: 45, discount: 0, tax: 3.60, total: 48.60, paymentMethod: "Credit Card", staff: "Alex Morgan" },
      { id: "p9", date: new Date("2026-01-05"), items: ["Classic Haircut", "Beard Trim"], subtotal: 70, discount: 5, tax: 5.20, total: 70.20, paymentMethod: "Debit Card", staff: "Daniel Park" },
    ],
    c3: [
      { id: "p10", date: new Date("2026-02-12"), items: ["Keratin Treatment"], subtotal: 250, discount: 25, tax: 18.00, total: 243.00, paymentMethod: "Credit Card", staff: "Alex Morgan" },
      { id: "p11", date: new Date("2026-02-01"), items: ["Color Treatment", "Blowout & Style"], subtotal: 185, discount: 0, tax: 14.80, total: 199.80, paymentMethod: "Credit Card", staff: "Sarah Kim" },
      { id: "p12", date: new Date("2026-01-18"), items: ["Facial Treatment"], subtotal: 85, discount: 0, tax: 6.80, total: 91.80, paymentMethod: "Debit Card", staff: "Jessica Lee" },
      { id: "p13", date: new Date("2026-01-05"), items: ["Swedish Massage", "Manicure & Pedicure"], subtotal: 150, discount: 10, tax: 11.20, total: 151.20, paymentMethod: "Credit Card", staff: "Jessica Lee" },
      { id: "p14", date: new Date("2025-12-20"), items: ["Highlights"], subtotal: 120, discount: 0, tax: 9.60, total: 129.60, paymentMethod: "Credit Card", staff: "Alex Morgan" },
    ],
  }

  // For clients without specific data, generate generic purchases based on their totalSpent
  if (purchaseData[clientId]) return purchaseData[clientId]

  const baseDate = new Date("2026-02-15")
  const services = [
    { items: ["Classic Haircut"], subtotal: 45 },
    { items: ["Deep Tissue Massage"], subtotal: 95 },
    { items: ["Manicure & Pedicure"], subtotal: 65 },
    { items: ["Facial Treatment"], subtotal: 85 },
    { items: ["Blowout & Style"], subtotal: 35 },
    { items: ["Color Treatment"], subtotal: 150 },
  ]
  const staffNames = ["Alex Morgan", "Jessica Lee", "Daniel Park", "Sarah Kim", "Ryan Cooper"]
  const methods = ["Credit Card", "Debit Card", "Cash"]

  // Create a deterministic seed from clientId
  const seed = parseInt(clientId.replace("c", ""), 10)
  const numPurchases = Math.min(seed % 4 + 2, 6)
  const result: PurchaseRow[] = []

  for (let i = 0; i < numPurchases; i++) {
    const svc = services[(seed + i) % services.length]
    const dayOffset = (i + 1) * (7 + (seed % 5))
    const date = new Date(baseDate)
    date.setDate(date.getDate() - dayOffset)
    const discount = i % 3 === 0 ? Math.round(svc.subtotal * 0.1) : 0
    const taxable = svc.subtotal - discount
    const tax = Math.round(taxable * TAX_RATE * 100) / 100
    result.push({
      id: `p-${clientId}-${i}`,
      date,
      items: svc.items,
      subtotal: svc.subtotal,
      discount,
      tax,
      total: Math.round((taxable + tax) * 100) / 100,
      paymentMethod: methods[(seed + i) % methods.length],
      staff: staffNames[(seed + i) % staffNames.length],
    })
  }

  return result
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

export function ClientPurchasesTab({ client }: ClientPurchasesTabProps) {
  const purchases = useMemo(() => generatePurchases(client.id), [client.id])

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
