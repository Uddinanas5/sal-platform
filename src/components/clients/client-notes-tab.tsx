"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  StickyNote,
  User,
  Save,
  FileIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { type Client } from "@/data/mock-data"

interface ClientNotesTabProps {
  client: Client
}

// NOTE: This timeline-style per-entry notes log and file attachment store have
// no backing model yet (the Client model only has a single free-text `notes`
// field, surfaced on the Overview tab, and there is no file storage). Persisting
// entries or uploads here would require a schema migration, so the controls are
// disabled and clearly labeled "Coming soon" rather than silently dropping data
// on refresh. The single staff-alert note remains fully editable on the Overview tab.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ClientNotesTab(props: ClientNotesTabProps) {
  const [newNote, setNewNote] = useState("")

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Add Note (coming soon) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="lg:col-span-2"
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <StickyNote className="w-4 h-4" />
              Add Note
              <Badge variant="secondary" className="text-xs ml-1">
                Coming soon
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="A timestamped notes log for this client is coming soon. To leave a staff alert today, use the Notes field on the Overview tab."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              maxLength={500}
              showCounter
              disabled
            />
            <div className="flex justify-end">
              <Button disabled size="sm" title="A timestamped notes log is coming soon">
                <Save className="w-4 h-4 mr-2" />
                Save Note
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notes List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="p-2.5 rounded-xl bg-cream-100">
                <User className="w-5 h-5 text-muted-foreground/70" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Timestamped notes log coming soon
              </p>
              <p className="text-xs text-muted-foreground/70 max-w-xs">
                A full activity log of per-staff notes is on the way. For now, use
                the staff alert field on the Overview tab.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Files Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              Files
              <Badge variant="secondary" className="text-xs ml-1">
                Coming soon
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="p-2.5 rounded-xl bg-cream-100">
                <FileIcon className="w-5 h-5 text-muted-foreground/70" />
              </div>
              <p className="text-sm font-medium text-foreground">
                File attachments coming soon
              </p>
              <p className="text-xs text-muted-foreground/70 max-w-xs">
                Securely attaching documents and images to a client profile is on
                the way.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
