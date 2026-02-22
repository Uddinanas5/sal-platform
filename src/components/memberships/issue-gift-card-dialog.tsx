"use client"

import React, { useState, useMemo } from "react"
import { Gift } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

const presetAmounts = [25, 50, 100, 150, 200]

interface ClientOption {
  id: string
  name: string
}

interface IssueGiftCardDialogProps {
  clients?: ClientOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IssueGiftCardDialog({
  clients = [],
  open,
  onOpenChange,
}: IssueGiftCardDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(100)
  const [customAmount, setCustomAmount] = useState("")
  const [isCustom, setIsCustom] = useState(false)
  const [purchaserId, setPurchaserId] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [expiryDate, setExpiryDate] = useState("")

  const generatedCode = useMemo(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const random = Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("")
    return `SAL-GIFT-${random}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const amount = isCustom ? Number(customAmount) : selectedPreset

  const handlePresetClick = (value: number) => {
    setSelectedPreset(value)
    setIsCustom(false)
    setCustomAmount("")
  }

  const handleCustomClick = () => {
    setIsCustom(true)
    setSelectedPreset(null)
  }

  const handleSave = () => {
    if (!amount || amount <= 0) {
      toast.error("Please select or enter a valid amount")
      return
    }

    if (!purchaserId) {
      toast.error("Please select a purchaser")
      return
    }

    toast.success("Gift card issued", {
      description: `${formatCurrency(amount)} gift card (${generatedCode}) has been created.`,
    })

    // Reset form
    setSelectedPreset(100)
    setCustomAmount("")
    setIsCustom(false)
    setPurchaserId("")
    setRecipientName("")
    setRecipientEmail("")
    setExpiryDate("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-sal-500" />
            Issue Gift Card
          </DialogTitle>
          <DialogDescription>
            Create a new gift card for a client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount</Label>
            <div className="flex flex-wrap gap-2">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200",
                    selectedPreset === preset && !isCustom
                      ? "bg-sal-500 text-white border-sal-500 shadow-md shadow-sal-500/20"
                      : "bg-card text-muted-foreground border-cream-200 hover:border-sal-300"
                  )}
                >
                  {formatCurrency(preset)}
                </button>
              ))}
              <button
                onClick={handleCustomClick}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200",
                  isCustom
                    ? "bg-sal-500 text-white border-sal-500 shadow-md shadow-sal-500/20"
                    : "bg-card text-muted-foreground border-cream-200 hover:border-sal-300"
                )}
              >
                Custom
              </button>
            </div>
            {isCustom && (
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70">
                  $
                </span>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="pl-7"
                  min="1"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Purchaser */}
          <div className="space-y-2">
            <Label>Purchased By *</Label>
            <Select value={purchaserId} onValueChange={setPurchaserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input
                placeholder="Recipient's name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          {/* Generated Code Preview */}
          <div className="bg-cream-100 p-4 rounded-xl border border-cream-200 text-center">
            <p className="text-xs text-muted-foreground/70 mb-1">Generated Gift Card Code</p>
            <p className="text-xl font-mono font-bold text-sal-600 tracking-wider">
              {generatedCode}
            </p>
            {amount && amount > 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                Value: {formatCurrency(amount)}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Gift className="w-4 h-4 mr-2" />
            Issue Gift Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
