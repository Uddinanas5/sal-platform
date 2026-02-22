"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Zap, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface QuickSaleButtonProps {
  onAddQuickSale: (amount: number, description: string) => void
}

export function QuickSaleButton({ onAddQuickSale }: QuickSaleButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    onAddQuickSale(parsedAmount, description || "Quick Sale")
    setAmount("")
    setDescription("")
    setIsOpen(false)
  }

  return (
    <>
      <motion.div
        className="fixed bottom-6 right-[42%] z-40"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="h-12 gap-2 rounded-full px-6 shadow-lg shadow-sal-500/30"
        >
          <Zap className="h-4 w-4" />
          Quick Sale
        </Button>
      </motion.div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-sal-500" />
              Quick Sale
            </DialogTitle>
            <DialogDescription>
              Add a custom amount without selecting a specific service or product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                  min="0.01"
                  step="0.01"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit()
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="e.g., Walk-in trim, Touch-up..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit()
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
