"use client"

import React, { useState, useTransition } from "react"
import { motion } from "framer-motion"
import {
  StickyNote,
  User,
  Save,
  Trash2,
  ImagePlus,
  X,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatDate, getInitials } from "@/lib/utils"
import { createVisitNote, deleteVisitNote } from "@/lib/actions/visit-notes"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

// A persisted visit/cut note, as fetched server-side from VisitNote.
export type VisitNoteItem = {
  id: string
  appointmentId: string | null
  authorId: string | null
  authorName: string | null
  body: string
  photoUrls: string[]
  createdAt: Date | string
}

interface ClientNotesTabProps {
  clientId: string
  notes: VisitNoteItem[]
  // Current user's staff id + role — used to gate "delete your own note".
  currentStaffId: string | null
  currentRole: string
}

export function ClientNotesTab({
  clientId,
  notes,
  currentStaffId,
  currentRole,
}: ClientNotesTabProps) {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoInput, setPhotoInput] = useState("")
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isPrivileged = currentRole === "admin" || currentRole === "owner"

  function canDelete(note: VisitNoteItem): boolean {
    if (isPrivileged) return true
    return !!currentStaffId && note.authorId === currentStaffId
  }

  function addPhotoUrl() {
    const url = photoInput.trim()
    if (!url) return
    try {
      // eslint-disable-next-line no-new
      new URL(url)
    } catch {
      toast.error("Enter a valid photo URL (https://...)")
      return
    }
    if (photoUrls.includes(url)) {
      setPhotoInput("")
      return
    }
    setPhotoUrls((prev) => [...prev, url])
    setPhotoInput("")
  }

  function removePhotoUrl(url: string) {
    setPhotoUrls((prev) => prev.filter((u) => u !== url))
  }

  function handleSave() {
    if (!body.trim() && photoUrls.length === 0) {
      toast.error("Add a note or at least one photo")
      return
    }
    startTransition(async () => {
      const result = await createVisitNote({
        clientId,
        body: body.trim() || undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      })
      if (result.success) {
        toast.success("Note saved")
        setBody("")
        setPhotoUrls([])
        setPhotoInput("")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to save note")
      }
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteVisitNote(id)
      if (result.success) {
        toast.success("Note deleted")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to delete note")
      }
      setDeletingId(null)
    })
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Add Note */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <StickyNote className="w-4 h-4" />
              Add Cut Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder='e.g. "#2 fade on the sides, scissors on top, beard lined up. Prefers it tighter next time."'
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={5000}
              showCounter
              disabled={isPending}
            />

            {/* Reference photo URLs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="url"
                  placeholder="Paste a reference photo URL (https://...)"
                  value={photoInput}
                  onChange={(e) => setPhotoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addPhotoUrl()
                    }
                  }}
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPhotoUrl}
                  disabled={isPending || !photoInput.trim()}
                >
                  <ImagePlus className="w-4 h-4 mr-1.5" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground/70">
                Paste image links for now. Direct photo upload coming soon.
              </p>
              {photoUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photoUrls.map((url) => (
                    <div
                      key={url}
                      className="relative w-16 h-16 rounded-lg overflow-hidden border border-cream-200 bg-cream-100 group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Reference"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhotoUrl(url)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || (!body.trim() && photoUrls.length === 0)}
              >
                <Save className="w-4 h-4 mr-2" />
                {isPending ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notes Log */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="border-cream-200">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              Notes
              {notes.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {notes.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="p-2.5 rounded-xl bg-cream-100">
                  <User className="w-5 h-5 text-muted-foreground/70" />
                </div>
                <p className="text-sm font-medium text-foreground">No notes yet</p>
                <p className="text-xs text-muted-foreground/70 max-w-xs">
                  Add a cut note above to start a timestamped log for this client.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex gap-3 pb-4 border-b border-cream-200 last:border-0 last:pb-0"
                  >
                    <div className="w-8 h-8 shrink-0 rounded-full bg-sal-100 text-mint-soft text-xs font-semibold flex items-center justify-center">
                      {note.authorName ? getInitials(note.authorName) : "–"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-foreground">
                            {note.authorName || "Unknown staff"}
                          </span>
                          <span className="text-muted-foreground/70 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(new Date(note.createdAt))}
                          </span>
                        </div>
                        {canDelete(note) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDelete(note.id)}
                            disabled={isPending && deletingId === note.id}
                            aria-label="Delete note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      {note.body && (
                        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                          {note.body}
                        </p>
                      )}
                      {note.photoUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {note.photoUrls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-16 h-16 rounded-lg overflow-hidden border border-cream-200 bg-cream-100"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt="Reference"
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
