"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
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
  ShoppingCart,
  Package,
  BarChart3,
  Megaphone,
  Star,
  CreditCard,
  Globe,
  X,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { hasRole, NAV_PERMISSIONS } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SidebarData {
  todayAppointments: number
  clientsCount: number
  lowStockCount: number
  pendingReviewsCount: number
  dashboardStats: {
    todayRevenue: number
    todayAppointments: number
    completedAppointments: number
    upcomingAppointments: number
  }
}

function buildNavSections(data: SidebarData | null, role?: string) {
  const allSections = [
    {
      label: "MAIN",
      items: [
        { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { href: "/calendar", icon: Calendar, label: "Calendar", badge: data?.todayAppointments || undefined },
        { href: "/clients", icon: Users, label: "Clients", badge: data?.clientsCount || undefined },
      ],
    },
    {
      label: "BUSINESS",
      items: [
        { href: "/services", icon: Scissors, label: "Services" },
        { href: "/checkout", icon: ShoppingCart, label: "POS / Checkout" },
        { href: "/inventory", icon: Package, label: "Inventory", badge: data?.lowStockCount || undefined },
      ],
    },
    {
      label: "GROWTH",
      items: [
        { href: "/reports", icon: BarChart3, label: "Reports" },
        { href: "/marketing", icon: Megaphone, label: "Marketing" },
        { href: "/reviews", icon: Star, label: "Reviews", badge: data?.pendingReviewsCount || undefined },
        { href: "/memberships", icon: CreditCard, label: "Memberships" },
      ],
    },
    {
      label: "MANAGE",
      items: [
        { href: "/booking", icon: Globe, label: "Online Booking" },
        { href: "/staff", icon: UserCircle, label: "Staff" },
        { href: "/settings", icon: Settings, label: "Settings" },
      ],
    },
  ]

  return allSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const perm = NAV_PERMISSIONS.find((p) => p.href === item.href)
        if (!perm) return true
        return hasRole(role, perm.minRole)
      }),
    }))
    .filter((section) => section.items.length > 0)
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  isMobile?: boolean
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

function SidebarContent({
  collapsed,
  onToggle,
  isMobile,
  onMobileClose,
}: {
  collapsed: boolean
  onToggle: () => void
  isMobile: boolean
  onMobileClose?: () => void
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [sidebarData, setSidebarData] = useState<SidebarData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchSidebarData() {
      try {
        const res = await fetch("/api/sidebar-data")
        if (!cancelled && res.ok) {
          const data = await res.json()
          setSidebarData(data)
        }
      } catch {
        // Silently fail - badges will just not show
      }
    }

    fetchSidebarData()
    return () => { cancelled = true }
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session?.user as any)?.role as string | undefined
  const navSections = buildNavSections(sidebarData, role)
  const stats = sidebarData?.dashboardStats

  return (
    <motion.aside
      initial={false}
      animate={{ width: isMobile ? 280 : collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 z-40 h-screen bg-cream-50 border-r border-cream-300/60 flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-cream-200">
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
          onClick={isMobile ? onMobileClose : undefined}
        >
          <motion.div
            animate={{ rotate: collapsed ? 0 : 0 }}
            className="w-10 h-10 flex-shrink-0"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <linearGradient id="owlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#34d399" }} />
                  <stop offset="50%" style={{ stopColor: "#059669" }} />
                  <stop offset="100%" style={{ stopColor: "#047857" }} />
                </linearGradient>
              </defs>
              <ellipse cx="50" cy="60" rx="30" ry="35" fill="url(#owlGrad)" />
              <circle cx="50" cy="35" r="25" fill="url(#owlGrad)" />
              <circle cx="42" cy="35" r="9" fill="white" />
              <circle cx="58" cy="35" r="9" fill="white" />
              <circle cx="42" cy="35" r="6" fill="#022c22" />
              <circle cx="58" cy="35" r="6" fill="#022c22" />
              <circle cx="44" cy="33" r="2.5" fill="white" opacity="0.9" />
              <circle cx="60" cy="33" r="2.5" fill="white" opacity="0.9" />
              <path d="M50 43 Q47 47 50 49 Q53 47 50 43" fill="#047857" />
            </svg>
          </motion.div>
          {(isMobile || !collapsed) && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-2xl font-heading font-bold bg-gradient-to-r from-sal-500 to-sal-700 bg-clip-text text-transparent"
            >
              SAL
            </motion.span>
          )}
        </Link>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="w-8 h-8 text-muted-foreground hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto" aria-label="Main navigation">
        <TooltipProvider delayDuration={0}>
        {navSections.map((section) => (
          <div key={section.label}>
            {(isMobile || !collapsed) && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase"
              >
                {section.label}
              </motion.p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                const showTooltip = !isMobile && collapsed

                const navLink = (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={isMobile ? onMobileClose : undefined}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <motion.div
                      whileHover={{ x: isActive ? 0 : 2 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "group/nav flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 relative",
                        isActive
                          ? "bg-sal-500 text-white shadow-lg shadow-sal-500/25"
                          : "text-muted-foreground hover:bg-cream-200 hover:text-foreground"
                      )}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-indicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-full -ml-1.5"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <item.icon className={cn(
                        "w-5 h-5 flex-shrink-0 transition-colors duration-200",
                        isActive ? "text-white" : "group-hover/nav:text-sal-600"
                      )} />
                      {(isMobile || !collapsed) && (
                        <>
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-sm font-medium flex-1"
                          >
                            {item.label}
                          </motion.span>
                          {item.badge && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1",
                                isActive
                                  ? "bg-white/25 text-white"
                                  : "bg-sal-100 text-sal-700"
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </motion.div>
                  </Link>
                )

                if (showTooltip) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        {navLink}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                        {item.badge ? ` (${item.badge})` : ""}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return <React.Fragment key={item.href}>{navLink}</React.Fragment>
              })}
            </div>
          </div>
        ))}
        </TooltipProvider>
      </nav>

      {/* Today's Summary */}
      {(isMobile || !collapsed) && (
        <div className="p-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-sal-50 to-sal-100 rounded-xl p-4 border border-sal-200/50"
          >
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-sal-600" />
              <span className="text-sm font-semibold text-sal-900">Today&apos;s Summary</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-sal-700">Revenue</span>
                <span className="text-sm font-bold text-sal-800">{formatCurrency(stats?.todayRevenue ?? 0)}</span>
              </div>
              <div className="h-1.5 bg-sal-200/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(((stats?.todayRevenue ?? 0) / 1200) * 100, 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="h-full bg-sal-500 rounded-full"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-sal-700">Appointments</span>
                <span className="text-sm font-semibold text-sal-800">
                  {stats?.completedAppointments ?? 0}/{stats?.todayAppointments ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-sal-700">Upcoming</span>
                <span className="text-sm font-semibold text-sal-800">{stats?.upcomingAppointments ?? 0}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <Separator className="bg-cream-200" />

      {/* User Profile */}
      <div className="p-3">
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-xl hover:bg-cream-200 cursor-pointer transition-colors",
          !isMobile && collapsed && "justify-center"
        )}>
          <Avatar className="w-9 h-9">
            <AvatarImage src="/avatars/user.jpg" />
            <AvatarFallback className="bg-sal-100 text-sal-700">
              {session?.user?.name
                ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
                : "U"}
            </AvatarFallback>
          </Avatar>
          {(isMobile || !collapsed) && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {session?.user?.name || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {session?.user?.role || "Member"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Button - desktop only */}
      {!isMobile && (
        <div className="absolute -right-3 top-20">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggle}
            className="w-6 h-6 rounded-full bg-cream-50 shadow-md border-cream-300 hover:bg-sal-50"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronLeft className="w-3 h-3" />
            )}
          </Button>
        </div>
      )}
    </motion.aside>
  )
}

export function Sidebar({ collapsed, onToggle, isMobile = false, isMobileOpen = false, onMobileClose }: SidebarProps) {
  // Mobile: render as overlay drawer with backdrop
  if (isMobile) {
    return (
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={onMobileClose}
            />
            {/* Drawer */}
            <motion.div
              key="sidebar-drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed left-0 top-0 z-50 h-screen"
            >
              <SidebarContent
                collapsed={false}
                onToggle={onToggle}
                isMobile={true}
                onMobileClose={onMobileClose}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    )
  }

  // Desktop: render as fixed sidebar (existing behavior)
  return (
    <SidebarContent
      collapsed={collapsed}
      onToggle={onToggle}
      isMobile={false}
    />
  )
}
