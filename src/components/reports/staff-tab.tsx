"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Star } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { BarChartComponent } from "@/components/charts/bar-chart"
import { formatCurrency } from "@/lib/utils"

type StaffMember = {
  name: string
  appointments: number
  revenue: number
  rating: number
  commission: number
}

interface StaffTabProps {
  staffPerformance: StaffMember[]
}

const columns: ColumnDef<StaffMember>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium text-foreground">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "appointments",
    header: "Appointments",
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("appointments")}</div>
    ),
  },
  {
    accessorKey: "revenue",
    header: "Revenue",
    cell: ({ row }) => (
      <div className="font-medium text-foreground">
        {formatCurrency(row.getValue("revenue"))}
      </div>
    ),
  },
  {
    accessorKey: "rating",
    header: "Rating",
    cell: ({ row }) => {
      const rating = row.getValue("rating") as number
      return (
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span className="font-medium text-foreground">{rating}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "commission",
    header: "Commission",
    cell: ({ row }) => (
      <div className="text-sal-600 font-medium">
        {formatCurrency(row.getValue("commission"))}
      </div>
    ),
  },
]

export function StaffTab({ staffPerformance }: StaffTabProps) {
  return (
    <div className="space-y-6">
      {/* Staff Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <DataTable
          columns={columns}
          data={staffPerformance}
          pageSize={10}
          showColumnToggle
          className="border border-cream-200 rounded-lg bg-card p-4"
        />
      </motion.div>

      {/* Comparison Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <BarChartComponent
          data={staffPerformance}
          dataKey="revenue"
          xAxisKey="name"
          title="Revenue Comparison"
          description="Staff revenue performance side by side"
          height={320}
          layout="vertical"
          formatValue={(v) => formatCurrency(v)}
          className="border-cream-200"
        />
      </motion.div>
    </div>
  )
}
