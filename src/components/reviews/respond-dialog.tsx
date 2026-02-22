"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { respondToReview } from "@/lib/actions/reviews"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StarRating } from "@/components/reviews/star-rating"
import type { Review } from "@/data/mock-reviews"

interface RespondDialogProps {
  review: Review | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const quickTemplates = [
  {
    label: "Thank you for feedback",
    value:
      "Thank you for your feedback! We truly appreciate you taking the time to share your experience with us.",
  },
  {
    label: "Appreciate kind words",
    value:
      "We appreciate your kind words! It means the world to us when our clients share their positive experiences. We look forward to seeing you again!",
  },
  {
    label: "Sorry about experience",
    value:
      "We're sorry to hear about your experience. Your satisfaction is our top priority, and we'd love the opportunity to make things right. Please reach out to us directly so we can address your concerns.",
  },
  {
    label: "Thanks and see you soon",
    value:
      "Thank you so much for the wonderful review! Our team works hard to provide the best experience possible, and feedback like yours keeps us motivated. See you next time!",
  },
]

const MAX_CHARS = 500

export function RespondDialog({
  review,
  open,
  onOpenChange,
}: RespondDialogProps) {
  const router = useRouter()
  const [response, setResponse] = useState("")
  const [isSending, setIsSending] = useState(false)

  const handleTemplateSelect = (templateValue: string) => {
    const template = quickTemplates.find((t) => t.value === templateValue)
    if (template) {
      setResponse(template.value)
    }
  }

  const handleSend = async () => {
    if (!response.trim() || !review) return
    setIsSending(true)

    const result = await respondToReview(review.id, response.trim())

    if (result.success) {
      toast.success("Response sent successfully")
      setResponse("")
      onOpenChange(false)
      router.refresh()
    } else {
      toast.error(`Failed to send response: ${result.error}`)
    }

    setIsSending(false)
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setResponse("")
    }
    onOpenChange(isOpen)
  }

  if (!review) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Respond to Review</DialogTitle>
          <DialogDescription>
            Write a response to {review.clientName}&apos;s review.
          </DialogDescription>
        </DialogHeader>

        {/* Original Review */}
        <div className="rounded-lg bg-cream-100 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-foreground">{review.clientName}</p>
            <StarRating rating={review.rating} size="sm" />
          </div>
          <p className="text-sm text-muted-foreground">{review.comment}</p>
        </div>

        {/* Quick Templates */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Quick Templates
          </label>
          <Select onValueChange={handleTemplateSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template..." />
            </SelectTrigger>
            <SelectContent>
              {quickTemplates.map((template) => (
                <SelectItem key={template.label} value={template.value}>
                  {template.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Response Textarea */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Your Response
          </label>
          <Textarea
            placeholder="Write your response..."
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={4}
            maxLength={MAX_CHARS}
            showCounter
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!response.trim() || isSending}>
            {isSending ? "Sending..." : "Send Response"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
