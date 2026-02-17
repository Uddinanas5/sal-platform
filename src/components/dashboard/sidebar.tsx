"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  UserCircle,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/clients", icon: Users, label: "Clients" },
  { href: "/services", icon: Scissors, label: "Services" },
  { href: "/staff", icon: UserCircle, label: "Staff" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: collapsed ? 0 : 0 }}
            className="w-10 h-10 flex-shrink-0"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <linearGradient id="owlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#FFA566" }} />
                  <stop offset="50%" style={{ stopColor: "#FF8C42" }} />
                  <stop offset="100%" style={{ stopColor: "#FF6B00" }} />
                </linearGradient>
              </defs>
              <ellipse cx="50" cy="60" rx="30" ry="35" fill="url(#owlGrad)" />
              <circle cx="50" cy="35" r="25" fill="url(#owlGrad)" />
              <circle cx="42" cy="35" r="9" fill="white" />
              <circle cx="58" cy="35" r="9" fill="white" />
              <circle cx="42" cy="35" r="6" fill="#2D1B00" />
              <circle cx="58" cy="35" r="6" fill="#2D1B00" />
              <circle cx="44" cy="33" r="2.5" fill="white" opacity="0.9" />
              <circle cx="60" cy="33" r="2.5" fill="white" opacity="0.9" />
              <path d="M50 43 Q47 47 50 49 Q53 47 50 43" fill="#FF6B00" />
            </svg>
          </motion.div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-2xl font-bold bg-gradient-to-r from-sal-500 to-sal-600 bg-clip-text text-transparent"
            >
              SAL
            </motion.span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-sal-500 text-white shadow-lg shadow-sal-500/30"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-white")} />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* Notifications */}
      {!collapsed && (
        <div className="p-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-sal-50 to-sal-100 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-sal-600" />
              <span className="text-sm font-semibold text-sal-900">3 New Bookings</span>
            </div>
            <p className="text-xs text-sal-700">You have pending appointments to confirm</p>
            <Button size="sm" className="mt-3 w-full">
              View All
            </Button>
          </motion.div>
        </div>
      )}

      <Separator />

      {/* User Profile */}
      <div className="p-3">
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors",
          collapsed && "justify-center"
        )}>
          <Avatar className="w-9 h-9">
            <AvatarImage src="/avatars/user.jpg" />
            <AvatarFallback className="bg-sal-100 text-sal-600">AM</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Alex Morgan</p>
              <p className="text-xs text-gray-500 truncate">Owner</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Button */}
      <div className="absolute -right-3 top-20">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggle}
          className="w-6 h-6 rounded-full bg-white shadow-md border-gray-200 hover:bg-sal-50"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </Button>
      </div>
    </motion.aside>
  )
}
