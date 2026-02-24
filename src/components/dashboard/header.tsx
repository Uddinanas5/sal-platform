"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { motion } from "framer-motion"
import { Search, Plus, ChevronDown, User, Settings, LogOut, HelpCircle, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationDropdown } from "@/components/dashboard/notification-dropdown"
import { CommandMenu } from "@/components/dashboard/command-menu"
import { useMobileSidebar } from "@/components/dashboard/mobile-sidebar-context"
import { toast } from "sonner"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { toggleMobileSidebar } = useMobileSidebar()

  return (
    <header className="h-16 bg-card/80 backdrop-blur-sm border-b border-cream-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left - Hamburger (mobile) + Title */}
      <div className="flex items-center gap-3">
        {toggleMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileSidebar}
            className="md:hidden w-9 h-9 -ml-2"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </Button>
        )}
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-heading font-semibold text-foreground"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-sm text-muted-foreground"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      </div>

      {/* Right - Search, Notifications, Profile */}
      <div className="flex items-center gap-3">
        {/* Mobile search icon */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden w-9 h-9"
          aria-label="Search"
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              })
            )
          }}
        >
          <Search className="w-5 h-5 text-muted-foreground" />
        </Button>

        {/* Desktop search bar */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
          <Input
            placeholder="Search clients, services..."
            className="w-64 pl-9 bg-cream-100 border-cream-200 focus:bg-white"
            readOnly
            onClick={() => {
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  metaKey: true,
                  bubbles: true,
                })
              )
            }}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-cream-100 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/70">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        {/* New Appointment Button */}
        <Button
          className="hidden sm:flex gap-2"
          onClick={() => router.push("/calendar")}
        >
          <Plus className="w-4 h-4" />
          New Booking
        </Button>

        {/* Notifications */}
        <NotificationDropdown />

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src="/avatars/user.jpg" />
                <AvatarFallback className="bg-sal-100 text-sal-700 text-sm">
                  {session?.user?.name
                    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
                    : "U"}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="w-4 h-4 text-muted-foreground/70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{session?.user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.email || ""}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Help center coming soon")}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Command Menu */}
      <CommandMenu />
    </header>
  )
}
