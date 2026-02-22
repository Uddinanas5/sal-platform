"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Mail,
  Phone,
  Edit,
  MessageSquare,
  CalendarPlus,
  MoreHorizontal,
  DollarSign,
  Calendar,
  Star,
  Clock,
  Wallet,
  Trash2,
  Copy,
  Ban,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  LayoutDashboard,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatCurrency,
  formatRelativeDate,
  getInitials,
} from "@/lib/utils"
import type { Client } from "@/data/mock-data"
import { ClientOverviewTab } from "@/components/clients/client-overview-tab"
import { ClientAppointmentsTab } from "@/components/clients/client-appointments-tab"
import { ClientPurchasesTab } from "@/components/clients/client-purchases-tab"
import { ClientNotesTab } from "@/components/clients/client-notes-tab"
import { ClientLoyaltyTab } from "@/components/clients/client-loyalty-tab"
import { EditClientDialog } from "@/components/clients/edit-client-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { deleteClient } from "@/lib/actions/clients"
import { toast } from "sonner"

interface ClientDetailClientProps {
  client: Client
}

export function ClientDetailClient(props: ClientDetailClientProps) {
  const { client } = props
  const router = useRouter()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const stats = [
    {
      label: "Total Spent",
      value: formatCurrency(client.totalSpent),
      icon: DollarSign,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Total Visits",
      value: client.totalVisits.toString(),
      icon: Calendar,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Loyalty Points",
      value: (client.loyaltyPoints || 0).toLocaleString(),
      icon: Star,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Wallet Balance",
      value: formatCurrency(client.walletBalance || 0),
      icon: Wallet,
      color: "bg-sal-100 text-sal-600",
    },
    {
      label: "Last Visit",
      value: client.lastVisit ? formatRelativeDate(new Date(client.lastVisit)) : "N/A",
      icon: Clock,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
  ]

  const handleSendMessage = () => {
    toast.success(`Message dialog opened for ${client.name}`)
  }

  const handleBookAppointment = () => {
    toast.success(`Booking appointment for ${client.name}`)
  }

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(client.email)
    toast.success("Email copied to clipboard")
  }

  const handleDeleteClient = () => {
    setDeleteDialogOpen(true)
  }

  const handleBlockClient = () => {
    toast.warning("Block client feature is not yet implemented")
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Breadcrumb navigation */}
      <div className="h-12 bg-card/80 backdrop-blur-sm border-b border-cream-200 px-6 flex items-center sticky top-0 z-30">
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/dashboard" className="text-muted-foreground/70 hover:text-muted-foreground transition-colors flex items-center gap-1">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/70" />
          <Link href="/clients" className="text-muted-foreground/70 hover:text-muted-foreground transition-colors flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            Clients
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/70" />
          <span className="text-foreground font-medium">{client.name}</span>
        </nav>
      </div>

      <div className="p-6 space-y-6">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-cream-200">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* Client Info */}
                <div className="flex items-center gap-5">
                  <Avatar className="w-20 h-20 ring-4 ring-sal-100">
                    <AvatarImage src={client.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-sal-400 to-sal-600 text-white font-semibold text-2xl">
                      {getInitials(client.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-heading font-bold text-foreground">
                        {client.name}
                      </h1>
                      {client.totalVisits <= 1 && (
                        <Badge className="bg-sal-100 text-sal-700 hover:bg-sal-100 text-[10px] px-1.5 py-0 font-semibold flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3" />
                          NEW
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {client.email}
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {client.phone}
                      </span>
                    </div>
                    {client.tags && client.tags.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
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
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditDialogOpen(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSendMessage}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                  <Button size="sm" onClick={handleBookAppointment}>
                    <CalendarPlus className="w-4 h-4 mr-2" />
                    Book Appointment
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleCopyEmail}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleBlockClient}>
                        <Ban className="w-4 h-4 mr-2" />
                        Block Client
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDeleteClient}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Client
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Client Alert Banner */}
        {client.notes && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
          >
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Staff Alert</p>
              <p className="text-sm text-amber-700 mt-0.5">{client.notes}</p>
            </div>
          </motion.div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <Card className="border-cream-200">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${stat.color}`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-heading font-bold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-card border border-cream-200">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
              <TabsTrigger value="notes">Notes & Files</TabsTrigger>
              <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ClientOverviewTab client={client} />
            </TabsContent>

            <TabsContent value="appointments">
              <ClientAppointmentsTab client={client} />
            </TabsContent>

            <TabsContent value="purchases">
              <ClientPurchasesTab client={client} />
            </TabsContent>

            <TabsContent value="notes">
              <ClientNotesTab client={client} />
            </TabsContent>

            <TabsContent value="loyalty">
              <ClientLoyaltyTab client={client} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Edit Dialog */}
      <EditClientDialog
        client={client}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Client"
        description={`Are you sure you want to delete "${client.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          const result = await deleteClient(client.id)
          if (result.success) {
            toast.success(`Client "${client.name}" deleted`)
            setDeleteDialogOpen(false)
            router.push("/clients")
          } else {
            toast.error(result.error || "Failed to delete client")
          }
        }}
      />
    </div>
  )
}
