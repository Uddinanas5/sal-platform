"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { UserCheck, ArrowUpRight } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { LineChartComponent } from "@/components/charts/line-chart"
import { PieChartComponent } from "@/components/charts/pie-chart"
import { formatCurrency } from "@/lib/utils"

type TopClient = {
  name: string
  visits: number
  spent: number
  lastVisit: string
}

interface ClientsTabProps {
  clientRetention: { month: string; newClients: number; returning: number }[]
  clientAcquisitionSources: { name: string; value: number; color: string }[]
  topClients: TopClient[]
  retentionRate: number
}

const columns: ColumnDef<TopClient>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium text-foreground">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "visits",
    header: "Visits",
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("visits")}</div>
    ),
  },
  {
    accessorKey: "spent",
    header: "Total Spent",
    cell: ({ row }) => (
      <div className="font-medium text-foreground">
        {formatCurrency(row.getValue("spent"))}
      </div>
    ),
  },
  {
    accessorKey: "lastVisit",
    header: "Last Visit",
    cell: ({ row }) => (
      <div className="text-muted-foreground">{row.getValue("lastVisit")}</div>
    ),
  },
]

export function ClientsTab({
  clientRetention,
  clientAcquisitionSources,
  topClients,
  retentionRate,
}: ClientsTabProps) {
  return (
    <div className="space-y-6">
      {/* Top Row: Retention Chart + Retention Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <LineChartComponent
          data={clientRetention}
          lines={[
            { dataKey: "newClients", color: "#059669", name: "New Clients" },
            { dataKey: "returning", color: "#34d399", name: "Returning" },
          ]}
          xAxisKey="month"
          title="New vs Returning Clients"
          description="Client retention over the last 6 months"
          height={300}
          showLegend={true}
          className="lg:col-span-2 border-cream-200"
        />
        <Card className="border-cream-200">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            <div className="p-4 rounded-full bg-sal-100 mb-4">
              <UserCheck className="w-8 h-8 text-sal-600" />
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Retention Rate</p>
            <p className="text-4xl font-heading font-bold text-foreground">
              {retentionRate}%
            </p>
            <div className="flex items-center gap-1 mt-2 text-sm text-sal-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span className="font-medium">+2.3%</span>
              <span className="text-muted-foreground/70">vs last month</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Clients Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="border border-cream-200 rounded-lg bg-card p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Top Clients</h3>
            <p className="text-sm text-muted-foreground">Highest-value clients this period</p>
          </div>
          <DataTable
            columns={columns}
            data={topClients}
            pageSize={10}
            showColumnToggle
          />
        </div>
      </motion.div>

      {/* Acquisition Sources */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <PieChartComponent
          data={clientAcquisitionSources}
          title="Acquisition Sources"
          description="How new clients find you"
          height={320}
          innerRadius={60}
          outerRadius={100}
          showLegend={true}
          formatValue={(v) => `${v}%`}
          className="border-cream-200"
        />
      </motion.div>
    </div>
  )
}
