"use client"

import React, { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Star,
  Download,
  Upload,
  UserPlus,
  Users,
  User,
  Pencil,
  MessageSquare,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  X,
  Tag,
  CheckSquare,
} from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { formatCurrency, formatDate, exportToCsv } from "@/lib/utils"
import { createClient, deleteClient } from "@/lib/actions/clients"
import type { Client } from "@/data/mock-data"

type SortColumn = "name" | "visits" | "spent" | "lastVisit"
type SortDirection = "asc" | "desc"

interface ClientsClientProps {
  initialClients: Client[]
}

function ClientCard({
  client,
  index,
  onDelete,
  selected,
  onToggleSelect,
}: {
  client: Client
  index: number
  onDelete: (client: Client) => void
  selected: boolean
  onToggleSelect: (id: string) => void
}) {
  const cardRouter = useRouter()
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      className="group relative bg-card rounded-2xl p-5 border border-cream-200 shadow-sm hover:shadow-md transition-all cursor-pointer card-warm"
    >
      {/* Selection checkbox */}
      <div
        className="absolute top-3 left-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(client.id)}
          className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
        />
      </div>

      <Link href={`/clients/${client.id}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14 ring-2 ring-sal-100">
              <AvatarImage src={client.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-sal-400 to-sal-600 text-white font-semibold text-lg">
                {client.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground">{client.name}</h3>
                {client.totalVisits <= 1 && (
                  <Badge className="bg-sal-100 text-sal-700 hover:bg-sal-100 text-[9px] px-1 py-0 font-semibold">
                    NEW
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{client.email}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" onClick={(e) => e.preventDefault()}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
              <DropdownMenuItem onClick={() => toast.info(`Viewing profile for ${client.name}`)}>
                <User className="w-4 h-4 mr-2" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info(`Editing ${client.name}`)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success(`Message sent to ${client.name}`)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => onDelete(client)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span>{client.phone}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-muted-foreground/70" />
              <span className="text-sm text-muted-foreground">
                {client.totalVisits} visits
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-muted-foreground/70" />
              <span className="text-sm text-muted-foreground">
                {formatCurrency(client.totalSpent)} spent
              </span>
            </div>
          </div>

          {client.tags && client.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {client.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant={tag === "VIP" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {client.lastVisit && (
            <p className="text-xs text-muted-foreground/70">
              Last visit: {formatDate(new Date(client.lastVisit))}
            </p>
          )}

          {/* Quick actions on hover */}
          <div className="flex items-center gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 border-t border-cream-200 mt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1 border-sal-200 text-sal-600 hover:bg-sal-50"
              onClick={(e) => {
                e.preventDefault()
                cardRouter.push("/calendar")
              }}
            >
              <Calendar className="w-3 h-3 mr-1" />
              Book
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={(e) => {
                e.preventDefault()
                toast.success(`Message sent to ${client.name}`)
              }}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Message
            </Button>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

interface ClientTableProps {
  clients: Client[]
  onDelete: (client: Client) => void
  sortColumn: SortColumn | null
  sortDirection: SortDirection
  onSort: (column: SortColumn) => void
  visibleColumns: Set<string>
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleAll: () => void
}

function SortHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: {
  label: string
  column: SortColumn
  activeColumn: SortColumn | null
  direction: SortDirection
  onSort: (column: SortColumn) => void
}) {
  const isActive = column === activeColumn
  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-1 text-left py-3 px-4 font-medium text-muted-foreground text-sm hover:text-foreground transition-colors group"
    >
      {label}
      {isActive ? (
        direction === "asc" ? (
          <ArrowUp className="w-3.5 h-3.5 text-sal-600" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5 text-sal-600" />
        )
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
      )}
    </button>
  )
}

function ClientTable({
  clients,
  onDelete,
  sortColumn,
  sortDirection,
  onSort,
  visibleColumns,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: ClientTableProps) {
  const router = useRouter()
  const allSelected = clients.length > 0 && clients.every((c) => selectedIds.has(c.id))
  const someSelected = clients.some((c) => selectedIds.has(c.id)) && !allSelected

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-cream-200">
            <th className="w-12 py-3 px-4">
              <Checkbox
                checked={allSelected}
                // @ts-expect-error indeterminate is valid for Radix checkbox
                indeterminate={someSelected}
                onCheckedChange={onToggleAll}
              />
            </th>
            <th className="text-left">
              <SortHeader label="Client" column="name" activeColumn={sortColumn} direction={sortDirection} onSort={onSort} />
            </th>
            {visibleColumns.has("contact") && (
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                Contact
              </th>
            )}
            {visibleColumns.has("visits") && (
              <th className="text-left">
                <SortHeader label="Visits" column="visits" activeColumn={sortColumn} direction={sortDirection} onSort={onSort} />
              </th>
            )}
            {visibleColumns.has("spent") && (
              <th className="text-left">
                <SortHeader label="Total Spent" column="spent" activeColumn={sortColumn} direction={sortDirection} onSort={onSort} />
              </th>
            )}
            {visibleColumns.has("lastVisit") && (
              <th className="text-left">
                <SortHeader label="Last Visit" column="lastVisit" activeColumn={sortColumn} direction={sortDirection} onSort={onSort} />
              </th>
            )}
            {visibleColumns.has("tags") && (
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                Tags
              </th>
            )}
            <th className="text-right py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client, index) => (
            <motion.tr
              key={client.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className={`border-b border-cream-200 hover:bg-cream-100 cursor-pointer transition-colors ${
                selectedIds.has(client.id) ? "bg-sal-50/50" : ""
              }`}
              onClick={() => router.push(`/clients/${client.id}`)}
            >
              <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(client.id)}
                  onCheckedChange={() => onToggleSelect(client.id)}
                />
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={client.avatar} />
                    <AvatarFallback className="bg-sal-100 text-sal-700 text-sm">
                      {client.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">{client.name}</span>
                </div>
              </td>
              {visibleColumns.has("contact") && (
                <td className="py-4 px-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      {client.email}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="w-3.5 h-3.5" />
                      {client.phone}
                    </div>
                  </div>
                </td>
              )}
              {visibleColumns.has("visits") && (
                <td className="py-4 px-4">
                  <span className="font-medium">{client.totalVisits}</span>
                </td>
              )}
              {visibleColumns.has("spent") && (
                <td className="py-4 px-4">
                  <span className="font-medium text-sal-600">
                    {formatCurrency(client.totalSpent)}
                  </span>
                </td>
              )}
              {visibleColumns.has("lastVisit") && (
                <td className="py-4 px-4 text-muted-foreground">
                  {client.lastVisit ? formatDate(new Date(client.lastVisit)) : "\u2014"}
                </td>
              )}
              {visibleColumns.has("tags") && (
                <td className="py-4 px-4">
                  <div className="flex gap-1">
                    {client.tags?.map((tag) => (
                      <Badge
                        key={tag}
                        variant={tag === "VIP" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </td>
              )}
              <td className="py-4 px-4 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => router.push(`/clients/${client.id}`)}>
                      <User className="w-4 h-4 mr-2" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info(`Editing ${client.name}`)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.success(`Message sent to ${client.name}`)}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Send Message
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => onDelete(client)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const columnOptions = [
  { key: "contact", label: "Contact" },
  { key: "visits", label: "Visits" },
  { key: "spent", label: "Total Spent" },
  { key: "lastVisit", label: "Last Visit" },
  { key: "tags", label: "Tags" },
]

export function ClientsClient(props: ClientsClientProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [newClientEmail, setNewClientEmail] = useState("")
  const [newClientPhone, setNewClientPhone] = useState("")
  const [newClientNotes, setNewClientNotes] = useState("")
  const [addClientErrors, setAddClientErrors] = useState<{ name?: string; email?: string }>({})
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)

  // Sort state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(["contact", "visits", "spent", "lastVisit", "tags"])
  )

  // Bulk delete confirm
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
        return column
      }
      setSortDirection("asc")
      return column
    })
  }, [])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const filteredClients = useMemo(() => {
    let clients = props.initialClients.filter((client) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch = !q ||
        client.name.toLowerCase().includes(q) ||
        client.email.toLowerCase().includes(q) ||
        client.phone.includes(q)
      const matchesFilter =
        selectedFilter === "all" ||
        (selectedFilter === "vip" && client.tags?.includes("VIP")) ||
        (selectedFilter === "new" && client.tags?.includes("New"))
      return matchesSearch && matchesFilter
    })

    // Apply sorting
    if (sortColumn) {
      clients = [...clients].sort((a, b) => {
        let cmp = 0
        switch (sortColumn) {
          case "name":
            cmp = a.name.localeCompare(b.name)
            break
          case "visits":
            cmp = a.totalVisits - b.totalVisits
            break
          case "spent":
            cmp = a.totalSpent - b.totalSpent
            break
          case "lastVisit": {
            const aTime = a.lastVisit ? new Date(a.lastVisit).getTime() : 0
            const bTime = b.lastVisit ? new Date(b.lastVisit).getTime() : 0
            cmp = aTime - bTime
            break
          }
        }
        return sortDirection === "desc" ? -cmp : cmp
      })
    }

    return clients
  }, [props.initialClients, searchQuery, selectedFilter, sortColumn, sortDirection])

  const handleToggleAll = useCallback(() => {
    const allIds = filteredClients.map((c) => c.id)
    const allSelected = allIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }, [filteredClients, selectedIds])

  const totalClients = props.initialClients.length
  const vipClients = props.initialClients.filter((c) => c.tags?.includes("VIP")).length
  const totalRevenue = props.initialClients.reduce((sum, c) => sum + c.totalSpent, 0)

  const selectedCount = selectedIds.size

  return (
    <div className="min-h-screen bg-cream">
      <Header
        title="Clients"
        subtitle={`${totalClients} total clients`}
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Clients", value: totalClients, icon: UserPlus },
            { label: "VIP Clients", value: vipClients, icon: Star },
            { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: DollarSign },
            { label: "Avg. per Client", value: formatCurrency(totalRevenue / totalClients), icon: DollarSign },
          ].map((stat, i) => (
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
                    <p className="text-xl font-heading font-bold text-foreground">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={selectedFilter} onValueChange={setSelectedFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="vip">VIP</TabsTrigger>
                <TabsTrigger value="new">New</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCsv(
                  "clients-export",
                  ["Name", "Email", "Phone", "Visits", "Total Spent", "Tags"],
                  filteredClients.map((c) => [
                    c.name,
                    c.email,
                    c.phone,
                    String(c.totalVisits),
                    formatCurrency(c.totalSpent),
                    (c.tags || []).join("; "),
                  ])
                )
                toast.success(`Exported ${filteredClients.length} clients to CSV`)
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Dialog open={isAddClientOpen} onOpenChange={(open) => {
              setIsAddClientOpen(open)
              if (!open) {
                setNewClientName("")
                setNewClientEmail("")
                setNewClientPhone("")
                setNewClientNotes("")
                setAddClientErrors({})
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading">Add New Client</DialogTitle>
                  <DialogDescription>
                    Enter the client&apos;s information below.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input
                      placeholder="John Doe"
                      value={newClientName}
                      onChange={(e) => {
                        setNewClientName(e.target.value)
                        if (addClientErrors.name) setAddClientErrors((prev) => ({ ...prev, name: undefined }))
                      }}
                    />
                    {addClientErrors.name && (
                      <p className="text-xs text-red-500">{addClientErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={newClientEmail}
                      onChange={(e) => {
                        setNewClientEmail(e.target.value)
                        if (addClientErrors.email) setAddClientErrors((prev) => ({ ...prev, email: undefined }))
                      }}
                    />
                    {addClientErrors.email && (
                      <p className="text-xs text-red-500">{addClientErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      placeholder="+1 (555) 000-0000"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes</label>
                    <Input
                      placeholder="Any additional notes..."
                      value={newClientNotes}
                      onChange={(e) => setNewClientNotes(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddClientOpen(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    const errors: { name?: string; email?: string } = {}
                    if (!newClientName.trim()) errors.name = "Name is required"
                    if (!newClientEmail.trim()) {
                      errors.email = "Email is required"
                    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClientEmail)) {
                      errors.email = "Please enter a valid email address"
                    }
                    if (Object.keys(errors).length > 0) {
                      setAddClientErrors(errors)
                      return
                    }
                    const nameParts = newClientName.trim().split(" ")
                    const firstName = nameParts[0]
                    const lastName = nameParts.slice(1).join(" ") || ""
                    const result = await createClient({
                      firstName,
                      lastName,
                      email: newClientEmail.trim() || undefined,
                      phone: newClientPhone.trim() || undefined,
                      notes: newClientNotes.trim() || undefined,
                    })
                    if (result.success) {
                      toast.success(`Client "${newClientName.trim()}" added successfully`)
                      setIsAddClientOpen(false)
                      setNewClientName("")
                      setNewClientEmail("")
                      setNewClientPhone("")
                      setNewClientNotes("")
                      setAddClientErrors({})
                      router.refresh()
                    } else {
                      toast.error(result.error)
                    }
                  }}>Add Client</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View Toggle + Column Visibility */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredClients.length} of {totalClients} clients
          </p>
          <div className="flex items-center gap-2">
            {viewMode === "list" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columnOptions.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={visibleColumns.has(col.key)}
                      onCheckedChange={() => handleToggleColumn(col.key)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
              <TabsList>
                <TabsTrigger value="grid">Grid</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Client List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client, index) => (
              <ClientCard
                key={client.id}
                client={client}
                index={index}
                onDelete={setDeleteTarget}
                selected={selectedIds.has(client.id)}
                onToggleSelect={handleToggleSelect}
              />
            ))}
          </div>
        ) : (
          <Card className="border-cream-200">
            <ClientTable
              clients={filteredClients}
              onDelete={setDeleteTarget}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              visibleColumns={visibleColumns}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleAll={handleToggleAll}
            />
          </Card>
        )}

        {filteredClients.length === 0 && (
          <EmptyState
            icon={<Users className="w-8 h-8 text-sal-600" />}
            title="No clients found"
            description="No clients match your current search or filter. Try adjusting your criteria or add a new client."
            action={{
              label: "Add Client",
              onClick: () => setIsAddClientOpen(true),
            }}
          />
        )}
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 sm:gap-3 bg-foreground text-white rounded-xl px-3 sm:px-5 py-2.5 sm:py-3 shadow-2xl shadow-gray-900/30">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckSquare className="w-4 h-4 text-sal-400" />
                <span className="text-xs sm:text-sm font-medium">
                  {selectedCount}
                  <span className="hidden sm:inline"> selected</span>
                </span>
              </div>
              <div className="w-px h-5 bg-foreground/80" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 sm:h-7 text-xs text-gray-300 hover:text-white hover:bg-foreground px-2 sm:px-3"
                onClick={() => {
                  toast.success(`Message sent to ${selectedCount} clients`)
                  setSelectedIds(new Set())
                }}
              >
                <MessageSquare className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Message</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 sm:h-7 text-xs text-gray-300 hover:text-white hover:bg-foreground px-2 sm:px-3"
                onClick={() => {
                  toast.success(`Tagged ${selectedCount} clients as "VIP"`)
                  setSelectedIds(new Set())
                }}
              >
                <Tag className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Tag</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 sm:h-7 text-xs text-gray-300 hover:text-white hover:bg-foreground px-2 sm:px-3"
                onClick={() => {
                  exportToCsv(
                    "clients-selected-export",
                    ["Name", "Email", "Phone", "Visits", "Total Spent", "Tags"],
                    Array.from(selectedIds)
                      .map((id) => props.initialClients.find((c) => c.id === id))
                      .filter(Boolean)
                      .map((c) => [
                        c!.name,
                        c!.email,
                        c!.phone,
                        String(c!.totalVisits),
                        formatCurrency(c!.totalSpent),
                        (c!.tags || []).join("; "),
                      ])
                  )
                  toast.success(`Exported ${selectedCount} clients to CSV`)
                }}
              >
                <Download className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 sm:h-7 text-xs text-red-400 hover:text-red-300 hover:bg-foreground px-2 sm:px-3"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
              <div className="w-px h-5 bg-foreground/80" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground/70 hover:text-white hover:bg-foreground"
                onClick={() => setSelectedIds(new Set())}
                aria-label="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Client"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteTarget) return
          const result = await deleteClient(deleteTarget.id)
          if (result.success) {
            toast.success(`Client "${deleteTarget.name}" deleted`)
            setDeleteTarget(null)
            router.refresh()
          } else {
            toast.error(result.error || "Failed to delete client")
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selectedCount} Clients`}
        description={`Are you sure you want to delete ${selectedCount} clients? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedCount}`}
        variant="destructive"
        onConfirm={async () => {
          const ids = Array.from(selectedIds)
          const results = await Promise.all(ids.map((id) => deleteClient(id)))
          const failedCount = results.filter((r) => !r.success).length
          if (failedCount > 0) {
            toast.error(`Failed to delete ${failedCount} of ${ids.length} clients`)
          } else {
            toast.success(`${ids.length} clients deleted`)
          }
          setSelectedIds(new Set())
          setBulkDeleteOpen(false)
          router.refresh()
        }}
      />
    </div>
  )
}
