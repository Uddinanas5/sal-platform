"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
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
// Plan data now comes from props, not mock data
import { EmptyState } from "@/components/shared/empty-state"
import { PlanCard } from "./plan-card"
import { CreatePlanDialog, type EditablePlan } from "./create-plan-dialog"
import { toggleMembershipPlan } from "@/lib/actions/memberships"
import { toast } from "sonner"
import type { MembershipPlan } from "@/data/mock-memberships"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import type { Member } from "@/data/mock-memberships"

interface PlanData {
  id: string
  name: string
  description: string | null
  price: number
  billingCycle: string
  benefits: string[]
  activeMembers: number
  isActive: boolean
  discountPercent?: number | null
}

interface MembershipsTabProps {
  members?: Member[]
  stats?: {
    totalMembers: number
    activeMembers: number
    mrr: number
  }
  plans?: PlanData[]
}

const columnHelper = createColumnHelper<Member>()

export function MembershipsTab({ members = [], stats = { totalMembers: 0, activeMembers: 0, mrr: 0 }, plans = [] }: MembershipsTabProps) {
  const router = useRouter()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<EditablePlan | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const planById = useMemo(() => {
    const map: Record<string, PlanData> = {}
    plans.forEach((p) => {
      map[p.id] = p
    })
    return map
  }, [plans])

  const handleEdit = (cardPlan: MembershipPlan) => {
    const source = planById[cardPlan.id]
    if (!source) return
    setEditingPlan({
      id: source.id,
      name: source.name,
      description: source.description,
      price: source.price,
      billingCycle: source.billingCycle,
      benefits: source.benefits,
      discountPercent: source.discountPercent ?? null,
    })
  }

  const handleToggleActive = async (cardPlan: MembershipPlan) => {
    setTogglingId(cardPlan.id)
    const result = await toggleMembershipPlan(cardPlan.id, !cardPlan.isActive)
    setTogglingId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(result.data.isActive ? "Plan activated" : "Plan deactivated")
    router.refresh()
  }

  const planColors = ["#059669", "#8b5cf6", "#f97316", "#ec4899", "#06b6d4", "#14b8a6"]
  const planColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    plans.forEach((p, i) => {
      map[p.name] = planColors[i % planColors.length]
    })
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans])

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
        {plans.length > 0 ? (
          plans.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={{
                id: plan.id,
                name: plan.name,
                description: plan.description || "",
                price: plan.price,
                interval: plan.billingCycle === "yearly" ? "yearly" : "monthly",
                features: plan.benefits.length > 0 ? plan.benefits : [`${plan.billingCycle} membership`],
                discount: plan.discountPercent ?? 0,
                maxServices: null,
                isActive: plan.isActive,
                memberCount: plan.activeMembers,
                color: planColors[i % planColors.length],
              }}
              index={i}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
              busy={togglingId === plan.id}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            <p>No membership plans yet.</p>
            <p className="text-sm mt-1">Create your first plan to start offering memberships.</p>
          </div>
        )}
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
                icon={<Users className="w-7 h-7 text-mint" />}
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
        onSaved={() => router.refresh()}
      />

      <CreatePlanDialog
        open={editingPlan !== null}
        onOpenChange={(open) => {
          if (!open) setEditingPlan(null)
        }}
        plan={editingPlan}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
