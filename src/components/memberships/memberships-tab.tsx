"use client"

import React, { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  Users,
  UserCheck,
  DollarSign,
  Plus,
  Search,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn, formatCurrency, getStatusColor } from "@/lib/utils"
import {
  mockMembershipPlans,
} from "@/data/mock-memberships"
import { EmptyState } from "@/components/shared/empty-state"
import { PlanCard } from "./plan-card"
import { CreatePlanDialog } from "./create-plan-dialog"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import type { Member } from "@/data/mock-memberships"

interface MembershipsTabProps {
  members?: Member[]
  stats?: {
    totalMembers: number
    activeMembers: number
    mrr: number
  }
}

const columnHelper = createColumnHelper<Member>()

export function MembershipsTab({ members = [], stats = { totalMembers: 0, activeMembers: 0, mrr: 0 } }: MembershipsTabProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const planColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    mockMembershipPlans.forEach((p) => {
      map[p.name] = p.color
    })
    return map
  }, [])

  const columns = useMemo(
    () => [
      columnHelper.accessor("clientName", {
        header: "Client Name",
        cell: (info) => (
          <span className="font-medium text-foreground">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("planName", {
        header: "Plan",
        cell: (info) => {
          const planName = info.getValue()
          const color = planColorMap[planName] || "#059669"
          return (
            <Badge
              variant="secondary"
              style={{
                backgroundColor: `${color}15`,
                color: color,
                borderColor: `${color}30`,
              }}
            >
              {planName}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("startDate", {
        header: "Start Date",
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
      columnHelper.accessor("nextBillingDate", {
        header: "Next Billing",
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
              {status.replace("_", " ")}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("totalSpent", {
        header: "Total Spent",
        cell: (info) => (
          <span className="text-sm font-semibold text-foreground">
            {formatCurrency(info.getValue())}
          </span>
        ),
      }),
    ],
    [planColorMap]
  )

  const table = useReactTable({
    data: members,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const searchValue =
    (table.getColumn("clientName")?.getFilterValue() as string) ?? ""

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Total Members",
            value: stats.totalMembers,
            icon: Users,
            iconBg: "bg-blue-500/10",
            iconColor: "text-blue-600",
          },
          {
            label: "Active Members",
            value: stats.activeMembers,
            icon: UserCheck,
            iconBg: "bg-emerald-500/10",
            iconColor: "text-emerald-600",
          },
          {
            label: "Monthly Revenue (MRR)",
            value: formatCurrency(stats.mrr),
            icon: DollarSign,
            iconBg: "bg-amber-500/10",
            iconColor: "text-amber-600",
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

      {/* Plan cards grid */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-semibold text-foreground">
          Membership Plans
        </h3>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {mockMembershipPlans.map((plan, i) => (
          <PlanCard key={plan.id} plan={plan} index={i} />
        ))}
      </div>

      {/* Members DataTable */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-heading font-semibold text-foreground">
            All Members
          </h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
            <Input
              placeholder="Search members..."
              value={searchValue}
              onChange={(e) =>
                table.getColumn("clientName")?.setFilterValue(e.target.value)
              }
              className="pl-9"
            />
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
                          className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
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
                        <td key={cell.id} className="px-4 py-3">
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
                icon={<Users className="w-7 h-7 text-sal-600" />}
                title="No members found"
                description="When clients subscribe to membership plans, they'll appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <CreatePlanDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  )
}
