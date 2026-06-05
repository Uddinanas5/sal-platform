"use client"

import React, { useState } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { Download, Copy, Check, Link as LinkIcon, Globe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function BookingQRCode({ businessSlug }: { businessSlug: string }) {
  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/${businessSlug}`
    : `/book/${businessSlug}`
  const qrUrl = `/api/booking-qr?slug=${encodeURIComponent(businessSlug)}`
  const [copied, setCopied] = useState(false)

  const handleDownload = async () => {
    try {
      const response = await fetch(qrUrl)
      if (!response.ok) throw new Error("Failed to generate QR code")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `sal-${businessSlug}-booking-qr.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success("QR code downloaded", {
        description: "The QR code image has been saved to your downloads.",
      })
    } catch {
      toast.error("Could not download QR code")
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    toast.success("Booking URL copied to clipboard", {
      description: "Share this link with your clients so they can book online.",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-sal-500" />
          QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center p-4 bg-white rounded-xl border border-cream-200"
        >
          <Image
            src={qrUrl}
            alt="Booking QR code"
            width={192}
            height={192}
            className="h-48 w-48 rounded-lg"
            unoptimized
          />
        </motion.div>

        {/* Copyable booking URL */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-cream-200 cursor-text"
              onClick={(e) => {
                const el = e.currentTarget.querySelector("span")
                if (el) {
                  const range = document.createRange()
                  range.selectNodeContents(el)
                  const sel = window.getSelection()
                  sel?.removeAllRanges()
                  sel?.addRange(range)
                }
              }}
            >
              <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground truncate select-all">
                {bookingUrl}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrl}
              className="gap-1.5 flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-xs">Copy URL</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4 mr-2" />
          Download QR Code
        </Button>
      </CardContent>
    </Card>
  )
}
