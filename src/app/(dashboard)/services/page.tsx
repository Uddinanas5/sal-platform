"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Plus,
  Search,
  MoreVertical,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  GripVertical,
  Palette,
} from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatCurrency } from "@/lib/utils"
import { mockServices, type Service } from "@/data/mock-data"

const categories = ["All", "Hair", "Wellness", "Nails", "Skincare"]

const colorOptions = [
  "#f97316", "#8b5cf6", "#10b981", "#ec4899", "#06b6d4",
  "#f59e0b", "#ef4444", "#3b82f6", "#84cc16", "#6366f1"
]

function ServiceCard({ service, index }: { service: Service; index: number }) {
  const [isActive, setIsActive] = useState(service.isActive)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      layout
      className={cn(
        "bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden",
        !isActive && "opacity-60"
      )}
    >
      {/* Color Bar */}
      <div
        className="h-2"
        style={{ backgroundColor: service.color }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <button className="mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
              <GripVertical className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {service.category}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {service.description}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{service.duration} min</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(service.price)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive ? (
              <Eye className="w-4 h-4 text-green-500" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-400" />
            )}
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function ServicesPage() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const filteredServices = mockServices.filter((service) => {
    const matchesSearch = service.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    const matchesCategory =
      selectedCategory === "All" || service.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const totalServices = mockServices.length
  const activeServices = mockServices.filter((s) => s.isActive).length
  const avgPrice =
    mockServices.reduce((sum, s) => sum + s.price, 0) / totalServices
  const avgDuration =
    mockServices.reduce((sum, s) => sum + s.duration, 0) / totalServices

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Services"
        subtitle="Manage your service offerings"
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Services", value: totalServices },
            { label: "Active Services", value: activeServices },
            { label: "Avg. Price", value: formatCurrency(avgPrice) },
            { label: "Avg. Duration", value: `${Math.round(avgDuration)} min` },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList>
                {categories.map((cat) => (
                  <TabsTrigger key={cat} value={cat}>
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Service</DialogTitle>
                <DialogDescription>
                  Create a new service for your business.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service Name</label>
                  <Input placeholder="e.g., Classic Haircut" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input placeholder="Brief description of the service" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration (min)</label>
                    <Input type="number" placeholder="45" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price ($)</label>
                    <Input type="number" placeholder="50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => c !== "All").map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Service Color
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded-lg border-2 border-transparent hover:border-gray-300 transition-colors"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsAddDialogOpen(false)}>
                  Add Service
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Services List */}
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {filteredServices.length} services
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredServices.map((service, index) => (
              <ServiceCard key={service.id} service={service} index={index} />
            ))}
          </div>
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No services found.</p>
            <Button variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Create your first service
            </Button>
          </div>
        )}

        {/* Categories Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Categories Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.filter(c => c !== "All").map((category) => {
                const categoryServices = mockServices.filter(
                  (s) => s.category === category
                )
                const totalRevenue = categoryServices.reduce(
                  (sum, s) => sum + s.price,
                  0
                )
                return (
                  <motion.div
                    key={category}
                    whileHover={{ scale: 1.02 }}
                    className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <h4 className="font-medium text-gray-900">{category}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {categoryServices.length} services
                    </p>
                    <p className="text-sm font-semibold text-sal-600 mt-2">
                      {formatCurrency(totalRevenue)} avg
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
