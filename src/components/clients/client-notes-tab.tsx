"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  StickyNote,
  User,
  Clock,
  Save,
  FileIcon,
  Download,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { FileUpload } from "@/components/ui/file-upload"
import { formatDate, formatRelativeDate } from "@/lib/utils"
import { type Client } from "@/data/mock-data"
import { toast } from "sonner"

interface ClientNotesTabProps {
  client: Client
}

interface Note {
  id: string
  date: Date
  author: string
  content: string
}

interface UploadedFile {
  id: string
  name: string
  size: string
  type: string
  uploadedAt: Date
  uploadedBy: string
}

const mockNotes: Note[] = [
  {
    id: "n1",
    date: new Date("2026-02-14"),
    author: "Sarah Kim",
    content: "Client mentioned interest in the new keratin treatment package. Follow up during next visit to discuss pricing and scheduling.",
  },
  {
    id: "n2",
    date: new Date("2026-02-01"),
    author: "Alex Morgan",
    content: "Allergic to certain hair dye brands. Always use the hypoallergenic line for color treatments. Client prefers ammonia-free products.",
  },
  {
    id: "n3",
    date: new Date("2026-01-15"),
    author: "Jessica Lee",
    content: "Prefers appointments in the morning (before 11am). Likes a quieter environment - book in the private room when available.",
  },
  {
    id: "n4",
    date: new Date("2025-12-20"),
    author: "Alex Morgan",
    content: "Discussed loyalty rewards program. Client was excited about the birthday discount. Make sure to send the birthday email reminder.",
  },
]

const mockUploadedFiles: UploadedFile[] = [
  {
    id: "f1",
    name: "consultation-form.pdf",
    size: "245 KB",
    type: "PDF",
    uploadedAt: new Date("2026-02-10"),
    uploadedBy: "Sarah Kim",
  },
  {
    id: "f2",
    name: "allergy-test-results.pdf",
    size: "128 KB",
    type: "PDF",
    uploadedAt: new Date("2026-01-05"),
    uploadedBy: "Alex Morgan",
  },
  {
    id: "f3",
    name: "reference-photo.jpg",
    size: "1.2 MB",
    type: "Image",
    uploadedAt: new Date("2025-12-18"),
    uploadedBy: "Jessica Lee",
  },
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ClientNotesTab(props: ClientNotesTabProps) {
  const [notes, setNotes] = useState<Note[]>(mockNotes)
  const [newNote, setNewNote] = useState("")
  const [files, setFiles] = useState<UploadedFile[]>(mockUploadedFiles)

  const handleAddNote = () => {
    if (!newNote.trim()) return

    const note: Note = {
      id: `n-${Date.now()}`,
      date: new Date(),
      author: "Alex Morgan",
      content: newNote.trim(),
    }
    setNotes([note, ...notes])
    setNewNote("")
    toast.success("Note added successfully")
  }

  const handleDeleteNote = (noteId: string) => {
    setNotes(notes.filter((n) => n.id !== noteId))
    toast.success("Note deleted")
  }

  const handleFilesSelected = (selectedFiles: File[]) => {
    const newFiles: UploadedFile[] = selectedFiles.map((f, i) => ({
      id: `f-${Date.now()}-${i}`,
      name: f.name,
      size: f.size > 1024 * 1024
        ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
        : `${(f.size / 1024).toFixed(0)} KB`,
      type: f.type.includes("image") ? "Image" : f.type.includes("pdf") ? "PDF" : "Document",
      uploadedAt: new Date(),
      uploadedBy: "Alex Morgan",
    }))
    setFiles([...newFiles, ...files])
    toast.success(`${selectedFiles.length} file(s) uploaded`)
  }

  const handleDeleteFile = (fileId: string) => {
    setFiles(files.filter((f) => f.id !== fileId))
    toast.success("File removed")
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Add Note */}
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
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Write a note about this client..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              maxLength={500}
              showCounter
            />
            <div className="flex justify-end">
              <Button onClick={handleAddNote} disabled={!newNote.trim()} size="sm">
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
            <CardTitle className="text-lg font-heading">
              Notes ({notes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notes.map((note, i) => (
                <div key={note.id}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span className="font-medium">{note.author}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeDate(note.date)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteNote(note.id)}
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-red-500" />
                      </Button>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-sm text-muted-foreground/70 text-center py-4">
                  No notes yet. Add the first one above.
                </p>
              )}
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
            <CardTitle className="text-lg font-heading">
              Files ({files.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload
              onFilesSelected={handleFilesSelected}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              multiple
            />

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-cream-50 hover:bg-cream-100 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-white border border-cream-200">
                      <FileIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.size} &middot; {file.uploadedBy} &middot; {formatDate(file.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {file.type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toast.success(`Downloading ${file.name}`)}
                      >
                        <Download className="w-3.5 h-3.5 text-muted-foreground/70" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteFile(file.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-red-500" />
                      </Button>
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
