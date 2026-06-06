"use client"

import { Download, FileJson, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportToCsv } from "@/lib/utils"
import type { VisitNoteItem } from "@/components/clients/client-notes-tab"
import type { LoyaltyTxItem } from "@/components/clients/client-loyalty-tab"

// The export bundles everything the profile already holds: the client record,
// their appointments (which carry the per-visit charge + status, i.e. the
// payment record), visit/cut notes, and the loyalty ledger. No extra fetch —
// this is the data the page already received from the server query.
export interface ExportableAppointment {
  id: string
  serviceName: string
  staffName: string
  startTime: Date | string
  endTime: Date | string
  status: string
  price: number
}

export interface ExportClientButtonProps {
  client: {
    id: string
    name: string
    email: string
    phone: string
    createdAt: Date | string
    lastVisit?: Date | string
    totalVisits: number
    totalSpent: number
    loyaltyPoints?: number
    walletBalance?: number
    tags?: string[]
    notes?: string
    allergies?: string
    dateOfBirth?: Date | string
  }
  appointments: ExportableAppointment[]
  visitNotes: VisitNoteItem[]
  loyaltyTransactions: LoyaltyTxItem[]
}

function toIso(v: Date | string | undefined | null): string {
  if (!v) return ""
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? "" : d.toISOString()
}

function safeFilename(name: string): string {
  return name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "client"
}

export function ExportClientButton(props: ExportClientButtonProps) {
  const { client, appointments, visitNotes, loyaltyTransactions } = props
  const base = `client-${safeFilename(client.name)}`

  function handleJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        dateOfBirth: toIso(client.dateOfBirth),
        createdAt: toIso(client.createdAt),
        lastVisit: toIso(client.lastVisit),
        totalVisits: client.totalVisits,
        totalSpent: client.totalSpent,
        loyaltyPoints: client.loyaltyPoints ?? 0,
        walletBalance: client.walletBalance ?? 0,
        tags: client.tags ?? [],
        notes: client.notes ?? "",
        allergies: client.allergies ?? "",
      },
      appointments: appointments.map((a) => ({
        id: a.id,
        service: a.serviceName,
        staff: a.staffName,
        startTime: toIso(a.startTime),
        endTime: toIso(a.endTime),
        status: a.status,
        amount: a.price,
      })),
      visitNotes: visitNotes.map((n) => ({
        id: n.id,
        appointmentId: n.appointmentId,
        author: n.authorName,
        body: n.body,
        createdAt: toIso(n.createdAt),
      })),
      loyaltyLedger: loyaltyTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        reason: t.reason ?? "",
        createdAt: toIso(t.createdAt),
      })),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${base}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Client data exported (JSON)")
  }

  function handleCsv() {
    // One CSV with a leading "section" column so profile, appointments, notes,
    // and the loyalty ledger all live in a single portable file.
    const headers = [
      "section",
      "field_or_id",
      "label_or_service",
      "detail_or_staff",
      "value_or_amount",
      "date",
    ]
    const rows: string[][] = []

    // Profile rows
    const profileFields: [string, string][] = [
      ["name", client.name],
      ["email", client.email],
      ["phone", client.phone],
      ["dateOfBirth", toIso(client.dateOfBirth)],
      ["createdAt", toIso(client.createdAt)],
      ["lastVisit", toIso(client.lastVisit)],
      ["totalVisits", String(client.totalVisits)],
      ["totalSpent", String(client.totalSpent)],
      ["loyaltyPoints", String(client.loyaltyPoints ?? 0)],
      ["walletBalance", String(client.walletBalance ?? 0)],
      ["tags", (client.tags ?? []).join("; ")],
      ["notes", client.notes ?? ""],
      ["allergies", client.allergies ?? ""],
    ]
    for (const [field, value] of profileFields) {
      rows.push(["profile", field, "", "", value, ""])
    }

    // Appointment rows (also the payment record: status + amount per visit)
    for (const a of appointments) {
      rows.push([
        "appointment",
        a.id,
        a.serviceName,
        a.staffName,
        `${a.status} / ${a.price}`,
        toIso(a.startTime),
      ])
    }

    // Visit notes
    for (const n of visitNotes) {
      rows.push([
        "note",
        n.id,
        n.authorName ?? "",
        "",
        n.body,
        toIso(n.createdAt),
      ])
    }

    // Loyalty ledger
    for (const t of loyaltyTransactions) {
      rows.push([
        "loyalty",
        t.id,
        t.type,
        t.reason ?? "",
        String(t.points),
        toIso(t.createdAt),
      ])
    }

    exportToCsv(base, headers, rows)
    toast.success("Client data exported (CSV)")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCsv}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleJson}>
          <FileJson className="w-4 h-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
