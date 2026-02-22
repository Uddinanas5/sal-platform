"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Download, Copy, Check, Link as LinkIcon, Globe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

function QRCodeSVG() {
  // Stylized placeholder QR code grid pattern (21x21 standard QR)
  const size = 21
  const cellSize = 6
  const padding = 10
  const svgSize = size * cellSize + padding * 2
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,1,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,0],
    [1,0,1,0,1,1,1,1,0,0,1,0,1,1,1,0,1,0,0,1,1],
    [0,1,0,1,0,0,0,1,1,0,0,1,0,1,0,1,0,1,1,0,0],
    [1,0,1,1,0,1,1,0,1,1,1,0,1,0,1,1,0,0,1,0,1],
    [0,1,0,0,1,0,0,1,0,0,1,1,0,1,0,0,1,1,0,1,0],
    [1,1,0,1,0,1,1,0,1,0,0,1,1,0,1,0,1,0,1,1,0],
    [0,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1],
    [1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,0,0,1,0,1,0],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1,1,0,1,1,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,1,1,0,0,1,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,1,0,1,1,0,0],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,0,0,0,1,0,0,1,1],
    [1,0,0,0,0,0,1,0,0,0,1,1,0,1,1,0,1,1,0,1,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,0,0,1,1,0,1],
  ]

  return (
    <svg
      width={svgSize}
      height={svgSize}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      className="mx-auto"
    >
      {/* White background */}
      <rect x="0" y="0" width={svgSize} height={svgSize} fill="white" rx="8" />

      {/* QR code cells */}
      {pattern.map((row, y) =>
        row.map((cell, x) => {
          // Leave a gap in the center for the logo
          const centerStart = 8
          const centerEnd = 12
          if (x >= centerStart && x <= centerEnd && y >= centerStart && y <= centerEnd) {
            return null
          }
          return cell === 1 ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize + padding}
              y={y * cellSize + padding}
              width={cellSize}
              height={cellSize}
              fill="#1a1a1a"
              rx={1}
            />
          ) : null
        })
      )}

      {/* Center logo background circle */}
      <circle
        cx={svgSize / 2}
        cy={svgSize / 2}
        r={cellSize * 3}
        fill="white"
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
      {/* Green accent circle */}
      <circle
        cx={svgSize / 2}
        cy={svgSize / 2}
        r={cellSize * 2.3}
        fill="#059669"
      />
      {/* SAL text */}
      <text
        x={svgSize / 2}
        y={svgSize / 2 + 4.5}
        textAnchor="middle"
        fill="white"
        fontSize="12"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        letterSpacing="1"
      >
        SAL
      </text>
    </svg>
  )
}

export function BookingQRCode() {
  const bookingUrl = "https://book.meetsal.com/luxe-salon"
  const [copied, setCopied] = useState(false)

  const handleDownload = () => {
    toast.success("QR Code downloaded", {
      description: "The QR code image has been saved to your downloads.",
    })
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
          <QRCodeSVG />
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
