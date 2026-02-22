"use client"

import React, { useState, useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatDuration,
  getStatusColor,
} from "@/lib/utils"
import type { Client, Appointment } from "@/data/mock-data"

interface ClientAppointmentsTabProps {
  client: Client & { appointments?: Appointment[] }
}

type AppointmentRow = {
  id: string
  date: Date
  service: string
  staff: string
  duration: number
  status: Appointment["status"]
  price: number
}

const columns: ColumnDef<AppointmentRow>[] = [
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
    cell: ({ row }) => {
      const date = row.getValue("date") as Date
      return (
        <div>
          <p className="font-medium text-sm">{formatDate(date)}</p>
          <p className="text-xs text-muted-foreground">{formatTime(date)}</p>
        </div>
      )
    },
    sortingFn: "datetime",
  },
  {
    accessorKey: "service",
    header: "Service",
    cell: ({ row }) => (
      <span className="font-medium text-sm">{row.getValue("service")}</span>
    ),
  },
  {
    accessorKey: "staff",
    header: "Staff",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.getValue("staff")}</span>
    ),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDuration(row.getValue("duration"))}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge className={getStatusColor(status)}>
          {status}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value === "all" || row.getValue(id) === value
    },
  },
  {
    accessorKey: "price",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Price
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium text-sm text-sal-600">
        {formatCurrency(row.getValue("price"))}
      </span>
    ),
  },
]

export function ClientAppointmentsTab({ client }: ClientAppointmentsTabProps) {
  const [statusFilter, setStatusFilter] = useState("all")

  const allAppointments: AppointmentRow[] = useMemo(() => {
    const appointments = client.appointments || []
    return appointments
      .map((a) => {
        const durationMs = new Date(a.endTime).getTime() - new Date(a.startTime).getTime()
        const durationMin = Math.round(durationMs / 60000)
        return {
          id: a.id,
          date: new Date(a.startTime),
          service: a.serviceName,
          staff: a.staffName,
          duration: durationMin,
          status: a.status,
          price: a.price,
        }
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [client.appointments])

  const filteredAppointments = useMemo(() => {
    if (statusFilter === "all") return allAppointments
    return allAppointments.filter((a) => a.status === statusFilter)
  }, [allAppointments, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? "s" : ""}
        </h3>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DataTable
        columns={columns}
        data={filteredAppointments}
        pageSize={8}
        showColumnToggle
      />
    </div>
  )
}
