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
  Scissors,
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
import type { Client, Appointment } from "@/data/mock-data"
import { ClientOverviewTab } from "@/components/clients/client-overview-tab"
import { ClientAppointmentsTab } from "@/components/clients/client-appointments-tab"
import { ClientPurchasesTab } from "@/components/clients/client-purchases-tab"
import { ClientNotesTab, type VisitNoteItem } from "@/components/clients/client-notes-tab"
import { ClientLoyaltyTab, type LoyaltyTxItem } from "@/components/clients/client-loyalty-tab"
import { EditClientDialog } from "@/components/clients/edit-client-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ExportClientButton } from "./export-client-button"
import { deleteClient } from "@/lib/actions/clients"
import { toast } from "sonner"

// The server query enriches the base mock `Client` shape with real, persisted
// visit notes + the loyalty ledger + appointments. These extra fields ride
// along on the client object passed from the server page.
type ClientWithRealData = Client & {
  visitNotes?: VisitNoteItem[]
  loyaltyTransactions?: LoyaltyTxItem[]
  appointments?: Appointment[]
}

interface ClientDetailClientProps {
  client: ClientWithRealData
  currentStaffId: string | null
  currentRole: string
}

export function ClientDetailClient(props: ClientDetailClientProps) {
  const { client, currentStaffId, currentRole } = props
  const visitNotes = client.visitNotes ?? []
  const loyaltyTransactions = client.loyaltyTransactions ?? []
  const appointments = client.appointments ?? []
  // Most-recent cut note for the read-only header chip ("last time: #2 fade").
  const lastCutNote = visitNotes.find((n) => n.body && n.body.trim().length > 0)
  const router = useRouter()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const stats = [
    {
      label: "Total Spent",
      value: formatCurrency(client.totalSpent),
      icon: DollarSign,
      color: "bg-emerald-500/10 text-emerald-400",
    },
    {
      label: "Total Visits",
      value: client.totalVisits.toString(),
      icon: Calendar,
      color: "bg-blue-500/10 text-blue-400",
    },
    {
      label: "Loyalty Points",
      value: (client.loyaltyPoints || 0).toLocaleString(),
      icon: Star,
      color: "bg-amber-500/10 text-amber-400",
    },
    {
      label: "Wallet Balance",
      value: formatCurrency(client.walletBalance || 0),
      icon: Wallet,
      color: "bg-sal-100 text-mint",
    },
    {
      label: "Last Visit",
      value: client.lastVisit ? formatRelativeDate(new Date(client.lastVisit)) : "N/A",
      icon: Clock,
      color: "bg-purple-500/10 text-purple-400",
    },
  ]

  const handleSendMessage = () => {
    if (client.email) {
      window.open(`mailto:${client.email}?subject=Hello from SAL`, "_blank")
      toast.success(`Opening email for ${client.name}`)
    } else {
      toast.error("No email address on file for this client")
    }
  }

  const handleBookAppointment = () => {
    router.push("/calendar")
  }

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(client.email)
    toast.success("Email copied to clipboard")
  }

  const handleDeleteClient = () => {
    setDeleteDialogOpen(true)
  }

  const handleBlockClient = async () => {
    const { updateClient } = await import("@/lib/actions/clients")
    const result = await updateClient(client.id, { tags: [...(client.tags || []), "Blocked"] })
    if (result.success) {
      toast.success(`${client.name} tagged as "Blocked" (note only — does not prevent booking)`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="min-h-screen">
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
          <Card>
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
                        <Badge className="bg-sal-100 text-mint-soft hover:bg-sal-100 text-[10px] px-1.5 py-0 font-semibold flex items-center gap-0.5">
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
                    {/* Last cut note — read-only at-a-glance ("last time: #2 fade") */}
                    {lastCutNote && (
                      <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground max-w-md">
                        <Scissors className="w-3.5 h-3.5 shrink-0 mt-0.5 text-mint-strong" />
                        <span>
                          <span className="font-medium text-foreground">Last cut:</span>{" "}
                          <span className="line-clamp-1">{lastCutNote.body}</span>
                        </span>
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
                  <ExportClientButton
                    client={client}
                    appointments={appointments}
                    visitNotes={visitNotes}
                    loyaltyTransactions={loyaltyTransactions}
                  />

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
                        Tag as Blocked (note only)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDeleteClient}
                        className="text-red-400 focus:text-red-400"
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

        {/* Allergy Alert Banner */}
        {client.allergies && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-start gap-3 p-4 bg-red-400/10 border border-red-400/30 rounded-xl"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-300">Allergies / Medical Alert</p>
              <p className="text-sm text-red-300 mt-0.5 whitespace-pre-wrap">{client.allergies}</p>
            </div>
          </motion.div>
        )}

        {/* Client Alert Banner */}
        {client.notes && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-start gap-3 p-4 bg-amber-400/10 border border-amber-400/30 rounded-xl"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Staff Alert</p>
              <p className="text-sm text-amber-300 mt-0.5">{client.notes}</p>
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
              <Card variant="tile">
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
            <TabsList>
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
              <ClientNotesTab
                clientId={client.id}
                notes={visitNotes}
                currentStaffId={currentStaffId}
                currentRole={currentRole}
              />
            </TabsContent>

            <TabsContent value="loyalty">
              <ClientLoyaltyTab
                loyaltyPoints={client.loyaltyPoints || 0}
                transactions={loyaltyTransactions}
              />
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
