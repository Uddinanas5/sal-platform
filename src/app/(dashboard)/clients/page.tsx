"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
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
} from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { mockClients, type Client } from "@/data/mock-data"

function ClientCard({ client, index }: { client: Client; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-14 h-14 ring-2 ring-sal-100">
            <AvatarImage src={client.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-sal-400 to-sal-600 text-white font-semibold text-lg">
              {client.name.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-gray-900">{client.name}</h3>
            <p className="text-sm text-gray-500">{client.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Phone className="w-4 h-4" />
            <span>{client.phone}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {client.totalVisits} visits
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
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
          <p className="text-xs text-gray-400">
            Last visit: {formatDate(client.lastVisit)}
          </p>
        )}
      </div>
    </motion.div>
  )
}

function ClientTable({ clients }: { clients: Client[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
              Client
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
              Contact
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
              Visits
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
              Total Spent
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
              Last Visit
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
              Tags
            </th>
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
              className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={client.avatar} />
                    <AvatarFallback className="bg-sal-100 text-sal-600 text-sm">
                      {client.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-gray-900">{client.name}</span>
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Mail className="w-3.5 h-3.5" />
                    {client.email}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5" />
                    {client.phone}
                  </div>
                </div>
              </td>
              <td className="py-4 px-4">
                <span className="font-medium">{client.totalVisits}</span>
              </td>
              <td className="py-4 px-4">
                <span className="font-medium text-green-600">
                  {formatCurrency(client.totalSpent)}
                </span>
              </td>
              <td className="py-4 px-4 text-gray-600">
                {client.lastVisit ? formatDate(client.lastVisit) : "—"}
              </td>
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
              <td className="py-4 px-4 text-right">
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ClientsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("all")

  const filteredClients = mockClients.filter((client) => {
    const matchesSearch = client.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    const matchesFilter =
      selectedFilter === "all" ||
      (selectedFilter === "vip" && client.tags?.includes("VIP")) ||
      (selectedFilter === "new" && client.tags?.includes("New"))
    return matchesSearch && matchesFilter
  })

  const totalClients = mockClients.length
  const vipClients = mockClients.filter((c) => c.tags?.includes("VIP")).length
  const totalRevenue = mockClients.reduce((sum, c) => sum + c.totalSpent, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Clients"
        subtitle={`${totalClients} total clients`}
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-sal-100">
                    <stat.icon className="w-5 h-5 text-sal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-xl font-bold text-gray-900">{stat.value}</p>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                  <DialogDescription>
                    Enter the client&apos;s information below.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input placeholder="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input type="email" placeholder="john@example.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes</label>
                    <Input placeholder="Any additional notes..." />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Cancel</Button>
                  <Button>Add Client</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {filteredClients.length} of {totalClients} clients
          </p>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
            <TabsList>
              <TabsTrigger value="grid">Grid</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Client List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client, index) => (
              <ClientCard key={client.id} client={client} index={index} />
            ))}
          </div>
        ) : (
          <Card>
            <ClientTable clients={filteredClients} />
          </Card>
        )}

        {filteredClients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No clients found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  )
}
