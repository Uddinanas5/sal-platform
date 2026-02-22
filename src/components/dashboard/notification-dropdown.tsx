"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Bell,
  CalendarPlus,
  DollarSign,
  Star,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn, formatRelativeDate } from "@/lib/utils"

interface Notification {
  id: string
  type: "booking" | "payment" | "review" | "cancellation" | "inventory" | "schedule"
  title: string
  description: string
  time: Date
  read: boolean
}

const notificationIcons: Record<Notification["type"], React.ElementType> = {
  booking: CalendarPlus,
  payment: DollarSign,
  review: Star,
  cancellation: XCircle,
  inventory: AlertTriangle,
  schedule: Clock,
}

const notificationColors: Record<Notification["type"], string> = {
  booking: "text-blue-500 bg-blue-500/10",
  payment: "text-emerald-500 bg-emerald-500/10",
  review: "text-amber-500 bg-amber-500/10",
  cancellation: "text-red-500 bg-red-500/10",
  inventory: "text-orange-500 bg-orange-500/10",
  schedule: "text-purple-500 bg-purple-500/10",
}

const notificationRoutes: Record<Notification["type"], string> = {
  booking: "/calendar",
  payment: "/checkout",
  review: "/reviews",
  cancellation: "/calendar",
  inventory: "/inventory",
  schedule: "/staff",
}

export function NotificationDropdown() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchNotifications() {
      try {
        const res = await fetch("/api/notifications")
        if (!cancelled && res.ok) {
          const data = await res.json()
          const mapped: Notification[] = (data.notifications || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (n: any) => ({
              ...n,
              time: new Date(n.time),
            })
          )
          setNotifications(mapped)
        }
      } catch {
        // Silently fail - notifications will just be empty
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    fetchNotifications()
    return () => { cancelled = true }
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => n.id === notification.id ? { ...n, read: true } : n)
    )
    // Navigate to relevant page
    const route = notificationRoutes[notification.type]
    router.push(route)
  }

  const markAllRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 animate-pulse">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-base font-heading">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-sal-600 hover:text-sal-700"
              onClick={markAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="h-[400px]">
          <div className="py-1">
            {!loaded && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading notifications...
              </div>
            )}
            {loaded && notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            )}
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type]
              const colorClass = notificationColors[notification.type]

              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-50",
                    !notification.read && "bg-sal-50/50"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      colorClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sal-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.description}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {formatRelativeDate(notification.time)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full text-sm text-sal-600 hover:text-sal-700 hover:bg-sal-50"
            onClick={() => toast.info("Notifications page coming soon")}
          >
            View All Notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
