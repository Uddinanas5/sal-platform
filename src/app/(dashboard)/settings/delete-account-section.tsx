"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { requestAccountDeletion } from "@/lib/actions/account"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DeleteAccountSectionProps {
  role: string
  businessName: string
}

export function DeleteAccountSection({ role, businessName }: DeleteAccountSectionProps) {
  const isOwner = role === "owner"
  const [open, setOpen] = useState(false)
  const [typedName, setTypedName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Exact, trimmed match — mirrors the server-side guard.
  const nameMatches = typedName.trim() === businessName.trim() && businessName.trim().length > 0

  async function handleConfirm() {
    if (!nameMatches) return
    setIsSubmitting(true)
    const result = await requestAccountDeletion({ confirmName: typedName })
    if (result.success) {
      // The request is recorded server-side; now end the browser session.
      toast.success("Your deletion request is recorded; data is removed within 30 days.")
      setOpen(false)
      await signOut({ callbackUrl: "/login" })
    } else {
      toast.error(result.error || "Could not process your deletion request")
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Once you request account deletion, your subscription is cancelled and your
        data is removed within 30 days. This cannot be undone.{" "}
        {!isOwner && (
          <span className="font-medium text-foreground">
            Only the business owner can delete the account.
          </span>
        )}
      </p>
      <Button
        variant="destructive"
        disabled={!isOwner}
        onClick={() => {
          setTypedName("")
          setOpen(true)
        }}
      >
        Delete Account
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isSubmitting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This cancels your subscription and submits a data-deletion request to
              our team. Your data is permanently removed within 30 days. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">
              Type your business name{" "}
              <span className="font-semibold text-foreground">{businessName}</span>{" "}
              to confirm
            </label>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={businessName}
              autoComplete="off"
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!nameMatches || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
