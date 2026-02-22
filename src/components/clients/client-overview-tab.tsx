"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Mail,
  Phone,
  Calendar,
  Clock,
  Tag,
  Plus,
  X,
  Save,
  Wallet,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
// Avatar imported for potential future use
import {
  formatCurrency,
  formatDate,
  formatTime,
  getStatusColor,
} from "@/lib/utils"
import type { Client, Appointment } from "@/data/mock-data"
import { toast } from "sonner"

interface ClientOverviewTabProps {
  client: Client & { appointments?: Appointment[] }
}

// Mock transactions for the overview (since mock-transactions module doesn't exist yet)
interface MockTransaction {
  id: string
  clientId: string
  date: Date
  items: string[]
  total: number
  paymentMethod: string
}

function getClientTransactions(clientId: string): MockTransaction[] {
  const transactions: MockTransaction[] = [
    { id: "t1", clientId: "c1", date: new Date("2026-02-10"), items: ["Classic Haircut", "Blowout & Style"], total: 80, paymentMethod: "Credit Card" },
    { id: "t2", clientId: "c1", date: new Date("2026-01-28"), items: ["Color Treatment"], total: 150, paymentMethod: "Credit Card" },
    { id: "t3", clientId: "c1", date: new Date("2026-01-15"), items: ["Highlights", "Deep Tissue Massage"], total: 215, paymentMethod: "Debit Card" },
    { id: "t4", clientId: "c2", date: new Date("2026-02-08"), items: ["Beard Trim"], total: 25, paymentMethod: "Cash" },
    { id: "t5", clientId: "c2", date: new Date("2026-01-20"), items: ["Classic Haircut"], total: 45, paymentMethod: "Credit Card" },
    { id: "t6", clientId: "c3", date: new Date("2026-02-12"), items: ["Keratin Treatment"], total: 250, paymentMethod: "Credit Card" },
    { id: "t7", clientId: "c3", date: new Date("2026-02-01"), items: ["Color Treatment", "Blowout & Style"], total: 185, paymentMethod: "Credit Card" },
    { id: "t8", clientId: "c3", date: new Date("2026-01-18"), items: ["Facial Treatment"], total: 85, paymentMethod: "Debit Card" },
    { id: "t9", clientId: "c4", date: new Date("2026-02-05"), items: ["Classic Haircut"], total: 45, paymentMethod: "Cash" },
    { id: "t10", clientId: "c5", date: new Date("2026-02-11"), items: ["Manicure & Pedicure"], total: 65, paymentMethod: "Credit Card" },
    { id: "t11", clientId: "c6", date: new Date("2026-02-14"), items: ["Deep Tissue Massage"], total: 95, paymentMethod: "Credit Card" },
    { id: "t12", clientId: "c7", date: new Date("2026-02-13"), items: ["Classic Haircut", "Beard Trim"], total: 70, paymentMethod: "Debit Card" },
  ]
  return transactions.filter((t) => t.clientId === clientId)
}

export function ClientOverviewTab({ client }: ClientOverviewTabProps) {
  const [notes, setNotes] = useState(client.notes || "")
  const [tags, setTags] = useState<string[]>(client.tags || [])
  const [newTag, setNewTag] = useState("")

  const clientAppointments = (client.appointments || [])
    .map((a) => ({ ...a, startTime: new Date(a.startTime), endTime: new Date(a.endTime) }))
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .slice(0, 5)

  const clientTransactions = getClientTransactions(client.id).slice(0, 5)

  const handleSaveNotes = () => {
    toast.success("Notes saved successfully")
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
      toast.success(`Tag "${newTag.trim()}" added`)
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
    toast.success(`Tag "${tag}" removed`)
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Contact Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sal-50">
                <Mail className="w-4 h-4 text-sal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{client.email}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sal-50">
                <Phone className="w-4 h-4 text-sal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{client.phone}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sal-50">
                <Calendar className="w-4 h-4 text-sal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date of Birth</p>
                <p className="text-sm font-medium">
                  {client.dateOfBirth ? formatDate(client.dateOfBirth) : "Not set"}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sal-50">
                <Clock className="w-4 h-4 text-sal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="text-sm font-medium">{formatDate(client.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Wallet Balance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Balance</span>
              <span className="text-2xl font-heading font-bold text-sal-600">
                {formatCurrency(client.walletBalance || 0)}
              </span>
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => toast.success("Top-up feature coming soon")}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Top Up
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={!client.walletBalance}
                onClick={() => toast.success("Redeem feature coming soon")}
              >
                Redeem
              </Button>
            </div>
            {(client.walletBalance || 0) > 0 && (
              <p className="text-xs text-muted-foreground/70">
                Can be applied at checkout
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Tags Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant={tag === "VIP" ? "default" : "secondary"}
                  className="text-xs gap-1"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground/70">No tags added</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add a tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1"
              />
              <Button size="sm" onClick={handleAddTag} disabled={!newTag.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Appointments */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Recent Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {clientAppointments.length > 0 ? (
              <div className="space-y-3">
                {clientAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-cream-50 hover:bg-cream-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{appt.serviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(appt.startTime)} at {formatTime(appt.startTime)} &middot; {appt.staffName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(appt.status)}>
                        {appt.status}
                      </Badge>
                      <span className="text-sm font-medium text-sal-600">
                        {formatCurrency(appt.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 text-center py-4">
                No appointments found
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Purchases */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Recent Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            {clientTransactions.length > 0 ? (
              <div className="space-y-3">
                {clientTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-cream-50 hover:bg-cream-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{txn.items.join(", ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(txn.date)} &middot; {txn.paymentMethod}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-sal-600">
                      {formatCurrency(txn.total)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 text-center py-4">
                No purchases found
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Notes Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="lg:col-span-2"
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Add notes about this client..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end">
              <Button onClick={handleSaveNotes} size="sm">
                <Save className="w-4 h-4 mr-2" />
                Save Notes
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
