"use client"

import React from "react"
import { motion } from "framer-motion"
import { Header } from "@/components/dashboard/header"
import { BookingSettings } from "@/components/booking/booking-settings"
import { BookingPreview } from "@/components/booking/booking-preview"
import { BookingWidgetCode } from "@/components/booking/booking-widget-code"
import { BookingQRCode } from "@/components/booking/booking-qr-code"
import type { Service, Staff } from "@/data/mock-data"

interface BookingClientProps {
  services: Service[]
  staff: Staff[]
}

export function BookingClient({ services, staff }: BookingClientProps) {
  return (
    <div className="min-h-screen bg-cream">
      <Header
        title="Online Booking"
        subtitle="Configure your online booking page and widget"
      />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Settings */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <BookingSettings services={services} />
            <BookingWidgetCode />
            <BookingQRCode />
          </motion.div>

          {/* Right: Preview in phone frame */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col items-center"
          >
            <div className="sticky top-24">
              <p className="text-sm font-semibold text-muted-foreground text-center mb-4">
                Live Preview
              </p>
              <BookingPreview services={services} staff={staff} />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
