"use client"

import React, { useState } from "react"
import { Pencil } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { updateStaffProfile } from "@/lib/actions/staff"

interface EditStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: {
    id: string
    firstName: string
    lastName: string
    phone: string
    commissionRate: number
    color: string
  }
}

export function EditStaffDialog({ open, onOpenChange, staff }: EditStaffDialogProps) {
  const [firstName, setFirstName] = useState(staff.firstName)
  const [lastName, setLastName] = useState(staff.lastName)
  const [phone, setPhone] = useState(staff.phone)
  const [commissionRate, setCommissionRate] = useState(staff.commissionRate.toString())
  const [color, setColor] = useState(staff.color)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const result = await updateStaffProfile({
      staffId: staff.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      commissionRate: parseFloat(commissionRate) || 0,
      color,
    })
    setSaving(false)

    if (result.success) {
      toast.success("Staff profile updated")
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-sal-500" />
            Edit Staff Member
          </DialogTitle>
          <DialogDescription>
            Update {staff.firstName}&apos;s profile information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Commission Rate (%)</Label>
              <Input type="number" min="0" max="100" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Calendar Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded-lg border border-cream-200 cursor-pointer" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !firstName.trim() || !lastName.trim()}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
