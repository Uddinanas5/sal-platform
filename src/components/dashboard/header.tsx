"use client"

import React from "react"
import { motion } from "framer-motion"
import { Search, Bell, Plus, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      {/* Left - Title */}
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-semibold text-gray-900"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-gray-500"
          >
            {subtitle}
          </motion.p>
        )}
      </div>

      {/* Right - Search, Notifications, Profile */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search clients, services..."
            className="w-64 pl-9 bg-gray-50 border-gray-200 focus:bg-white"
          />
        </div>

        {/* New Appointment Button */}
        <Button className="hidden sm:flex gap-2">
          <Plus className="w-4 h-4" />
          New Booking
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-sal-500 rounded-full" />
        </Button>

        {/* Profile Dropdown */}
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src="/avatars/user.jpg" />
            <AvatarFallback className="bg-sal-100 text-sal-600 text-sm">AM</AvatarFallback>
          </Avatar>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </Button>
      </div>
    </header>
  )
}
