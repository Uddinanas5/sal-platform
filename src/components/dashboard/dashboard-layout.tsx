"use client"

import React, { useState, useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowUp } from "lucide-react"
import { Sidebar } from "./sidebar"
import { MobileSidebarContext } from "./mobile-sidebar-context"
import { ShortcutGuideDialog } from "./shortcut-guide-dialog"

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
    }
    onChange(mql)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return isMobile
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [shortcutGuideOpen, setShortcutGuideOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const isMobile = useIsMobile()

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  // Scroll-to-top button visibility
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const router = useRouter()

  // Global keyboard shortcuts (when not in an input)
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      if (isInput || e.metaKey || e.ctrlKey) return

      // "/" opens command menu
      if (e.key === "/") {
        e.preventDefault()
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "k",
            metaKey: true,
            bubbles: true,
          })
        )
      }

      // "N" navigates to calendar (new booking)
      if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        router.push("/calendar")
      }

      // "D" toggles dark mode
      if (e.key === "d" || e.key === "D") {
        e.preventDefault()
        const root = document.documentElement
        const isDark = root.classList.contains("dark")
        if (isDark) {
          root.classList.remove("dark")
          localStorage.setItem("sal-theme", "light")
        } else {
          root.classList.add("dark")
          localStorage.setItem("sal-theme", "dark")
        }
      }

      // "?" opens shortcut guide
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault()
        setShortcutGuideOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeydown)
    return () => document.removeEventListener("keydown", handleKeydown)
  }, [router])

  const toggleMobileSidebar = useCallback(() => {
    setMobileOpen((prev) => !prev)
  }, [])

  const closeMobileSidebar = useCallback(() => {
    setMobileOpen(false)
  }, [])

  return (
    <MobileSidebarContext.Provider
      value={{ toggleMobileSidebar: isMobile ? toggleMobileSidebar : undefined }}
    >
      <div className="min-h-screen bg-cream">
        <Sidebar
          collapsed={isMobile ? false : sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobile={isMobile}
          isMobileOpen={mobileOpen}
          onMobileClose={closeMobileSidebar}
        />
        <motion.main
          initial={false}
          animate={{ marginLeft: isMobile ? 0 : sidebarCollapsed ? 80 : 280 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="min-h-screen"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.main>
        <ShortcutGuideDialog
          open={shortcutGuideOpen}
          onOpenChange={setShortcutGuideOpen}
        />

        {/* Scroll-to-top FAB */}
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-sal-500 text-white shadow-lg shadow-sal-500/25 flex items-center justify-center hover:bg-sal-600 transition-colors"
              aria-label="Scroll to top"
            >
              <ArrowUp className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </MobileSidebarContext.Provider>
  )
}
