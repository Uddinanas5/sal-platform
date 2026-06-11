"use client"

import React, { useEffect, useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import {
  POINTS_TO_DOLLARS,
  dollarsForPoints,
  maxRedeemablePoints,
} from "@/lib/loyalty"
import { getClientLoyaltyBalance } from "@/lib/actions/loyalty"

interface LoyaltyRedeemSectionProps {
  clientId: string | null
  subtotal: number
  // Currently-applied redeem points (lives in the parent cart reducer).
  redeemPoints: number
  onSetRedeemPoints: (points: number) => void
}

/**
 * Cash-only checkout affordance: redeem a client's loyalty points as a DISCOUNT
 * (never a tender). The available balance is read from the server for the
 * authenticated business (multi-tenant safe). The applied amount shown here is
 * only a PREVIEW — recordCheckout independently re-validates and re-caps the
 * dollar value server-side, so a tampered client can never over-redeem.
 */
export function LoyaltyRedeemSection({
  clientId,
  subtotal,
  redeemPoints,
  onSetRedeemPoints,
}: LoyaltyRedeemSectionProps) {
  const [available, setAvailable] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")

  // Load the client's live balance whenever the selected client changes.
  useEffect(() => {
    let cancelled = false
    if (!clientId) {
      setAvailable(null)
      return
    }
    setLoading(true)
    getClientLoyaltyBalance(clientId)
      .then((res) => {
        if (cancelled) return
        setAvailable(res.success ? res.data.points : 0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  // No client selected → nothing to redeem against.
  if (!clientId) return null

  const cap = available === null ? 0 : maxRedeemablePoints(available, subtotal)
  const appliedAmount = dollarsForPoints(redeemPoints)

  const apply = () => {
    const parsed = Math.floor(Number(input))
    if (!Number.isFinite(parsed) || parsed <= 0) return
    onSetRedeemPoints(Math.min(parsed, cap))
    setInput("")
  }

  return (
    <div className="space-y-2 rounded-lg border border-sal-200 bg-sal-50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-mint" />
          <p className="text-xs font-medium text-mint-soft">Loyalty points</p>
        </div>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-[11px] font-medium text-muted-foreground">
            {(available ?? 0).toLocaleString()} pts available
          </span>
        )}
      </div>

      {redeemPoints > 0 ? (
        <div className="flex items-center justify-between rounded-md bg-white/[0.08] px-2.5 py-1.5">
          <span className="text-xs text-mint-soft">
            {redeemPoints.toLocaleString()} pts applied
            <span className="ml-1 font-semibold">-{formatCurrency(appliedAmount)}</span>
          </span>
          <button
            type="button"
            onClick={() => onSetRedeemPoints(0)}
            className="text-[11px] text-muted-foreground underline hover:text-foreground"
          >
            Remove
          </button>
        </div>
      ) : cap > 0 ? (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={cap}
              step={1}
              placeholder={`Up to ${cap.toLocaleString()} pts`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply()
              }}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" className="h-8" onClick={apply}>
              Apply
            </Button>
          </div>
          <button
            type="button"
            onClick={() => onSetRedeemPoints(cap)}
            className="text-[11px] text-mint underline hover:text-mint-soft"
          >
            Use max ({cap.toLocaleString()} pts = {formatCurrency(dollarsForPoints(cap))})
          </button>
          <p className="text-[10px] text-muted-foreground">
            {Math.round(1 / POINTS_TO_DOLLARS)} pts = {formatCurrency(1)} off
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {available && available > 0
            ? "Add items to the cart to redeem points."
            : "No points available to redeem."}
        </p>
      )}
    </div>
  )
}
