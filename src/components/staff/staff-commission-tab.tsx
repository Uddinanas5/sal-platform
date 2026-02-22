"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { DollarSign, Percent, TrendingUp, Settings } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Staff, Appointment } from "@/data/mock-data"
import { toast } from "sonner"

interface StaffCommissionTabProps {
  staff: Staff
  appointments: Appointment[]
}

interface CommissionRow {
  id: string
  date: Date
  service: string
  client: string
  revenue: number
  commissionAmount: number
}

const columns: ColumnDef<CommissionRow>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-sm">{formatDate(row.original.date)}</span>
    ),
  },
  {
    accessorKey: "service",
    header: "Service",
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.original.service}</span>
    ),
  },
  {
    accessorKey: "client",
    header: "Client",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.client}</span>
    ),
  },
  {
    accessorKey: "revenue",
    header: "Revenue",
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {formatCurrency(row.original.revenue)}
      </span>
    ),
  },
  {
    accessorKey: "commissionAmount",
    header: "Commission",
    cell: ({ row }) => (
      <span className="text-sm font-semibold text-sal-600">
        {formatCurrency(row.original.commissionAmount)}
      </span>
    ),
  },
]

export function StaffCommissionTab({ staff, appointments }: StaffCommissionTabProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newRate, setNewRate] = useState(staff.commission ?? 35)

  const commissionRate = staff.commission ?? 35

  // Build commission rows from appointments passed via props
  const staffAppointments = appointments
    .filter((a) => a.status === "completed")
    .map((a) => ({ ...a, startTime: new Date(a.startTime), endTime: new Date(a.endTime) }))
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .slice(0, 10)

  const commissionData: CommissionRow[] = staffAppointments.map((a) => ({
    id: a.id,
    date: a.startTime,
    service: a.serviceName,
    client: a.clientName,
    revenue: a.price,
    commissionAmount: Math.round(a.price * (commissionRate / 100) * 100) / 100,
  }))

  const totalCommissionThisMonth = commissionData.reduce(
    (sum, c) => sum + c.commissionAmount,
    0
  )

  const totalRevenueThisMonth = commissionData.reduce(
    (sum, c) => sum + c.revenue,
    0
  )

  const handleSaveRate = () => {
    toast.success(
      `Commission rate updated to ${newRate}% for ${staff.name}`
    )
    setSettingsOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Commission Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sal-100 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-sal-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Commission Rate</p>
                  <p className="text-xl font-bold text-foreground">
                    {commissionRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">of service revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Commission This Month
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(totalCommissionThisMonth)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Revenue Generated</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(totalRevenueThisMonth)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Commission Settings */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Commission Earnings</h3>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Adjust Rate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Commission Settings</DialogTitle>
              <DialogDescription>
                Adjust the commission rate for {staff.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Commission Rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={newRate}
                  onChange={(e) => setNewRate(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Current rate: {commissionRate}%
                </p>
              </div>

              <div className="bg-cream-100 rounded-lg p-3">
                <p className="text-sm text-foreground">
                  With a {newRate}% rate, {staff.name} would earn{" "}
                  <span className="font-semibold">
                    {formatCurrency(100 * (newRate / 100))}
                  </span>{" "}
                  commission on a $100 service.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSettingsOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveRate}>Save Rate</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Commission Table */}
      <Card>
        <CardContent className="p-4">
          <DataTable
            columns={columns}
            data={commissionData}
            pageSize={10}
            showColumnToggle
          />
        </CardContent>
      </Card>
    </div>
  )
}
