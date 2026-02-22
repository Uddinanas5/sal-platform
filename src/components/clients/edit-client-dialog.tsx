"use client"

import React, { useState } from "react"
import { X, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { type Client } from "@/data/mock-data"
import { toast } from "sonner"

interface EditClientDialogProps {
  client: Client
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const [name, setName] = useState(client.name)
  const [email, setEmail] = useState(client.email)
  const [phone, setPhone] = useState(client.phone)
  const [dateOfBirth, setDateOfBirth] = useState(
    client.dateOfBirth
      ? client.dateOfBirth.toISOString().split("T")[0]
      : ""
  )
  const [notes, setNotes] = useState(client.notes || "")
  const [tags, setTags] = useState<string[]>(client.tags || [])
  const [newTag, setNewTag] = useState("")

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!email.trim()) {
      toast.error("Email is required")
      return
    }

    // In a real app, this would call an API
    toast.success("Client information updated successfully")
    onOpenChange(false)
  }

  const handleCancel = () => {
    // Reset form to original values
    setName(client.name)
    setEmail(client.email)
    setPhone(client.phone)
    setDateOfBirth(
      client.dateOfBirth
        ? client.dateOfBirth.toISOString().split("T")[0]
        : ""
    )
    setNotes(client.notes || "")
    setTags(client.tags || [])
    setNewTag("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit Client</DialogTitle>
          <DialogDescription>
            Update {client.name}&apos;s information below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Phone</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Date of Birth</label>
            <Input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <div className="flex items-center gap-2 flex-wrap mb-2">
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
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add a tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddTag}
                disabled={!newTag.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              maxLength={500}
              showCounter
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
