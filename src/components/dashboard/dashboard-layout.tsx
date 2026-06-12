"use client"

import React, { useState, useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { ArrowUp, AlertTriangle, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
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

// Open-dispute (chargeback) notice. Merchant-liability tone is deliberate:
// the SHOP bears a lost chargeback, so the banner says so plainly and pushes
// the owner to respond with evidence before the deadline.
export interface DisputeBannerData {
  count: number
  totalAmountCents: number
  evidenceDueBy: string | null // ISO string of the EARLIEST deadline, or null
}

interface DashboardLayoutProps {
  children: React.ReactNode
  // Non-blocking billing notice. "past_due" → amber banner prompting a card
  // update via the billing portal. "paused" → amber banner noting the temporary
  // hold. null → no banner (the common case).
  billingBanner?: "past_due" | "paused" | null
  // Open dispute notice — red banner rendered ABOVE the amber billing banner
  // (money leaving beats money owed). null → no banner (the common case).
  disputeBanner?: DisputeBannerData | null
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function DashboardLayout({
  children,
  billingBanner = null,
  disputeBanner = null,
}: DashboardLayoutProps) {
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

  // CTA for the dispute banner → the existing Stripe Express dashboard-link
  // route (server-side resolves the caller's OWN connected account; never
  // accepts an account id from the browser). Evidence is submitted in Stripe.
  const [disputeLinkLoading, setDisputeLinkLoading] = useState(false)
  const openStripeDashboard = useCallback(async () => {
    setDisputeLinkLoading(true)
    try {
      const response = await fetch("/api/stripe/dashboard-link", { method: "POST" })
      if (!response.ok) throw new Error("Failed to create dashboard link")
      const { url } = await response.json()
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (error) {
      console.error("Error opening payment dashboard:", error)
      toast.error("Couldn't open the Stripe dashboard. Please try again.")
    } finally {
      setDisputeLinkLoading(false)
    }
  }, [])

  return (
    <MobileSidebarContext.Provider
      value={{ toggleMobileSidebar: isMobile ? toggleMobileSidebar : undefined }}
    >
      <div className="min-h-screen app-canvas env-grain">
        <Sidebar
          collapsed={isMobile ? false : sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobile={isMobile}
          isMobileOpen={mobileOpen}
          onMobileClose={closeMobileSidebar}
        />
        <motion.main
          initial={false}
          animate={{ marginLeft: isMobile ? 0 : sidebarCollapsed ? 92 : 292 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="min-h-screen"
        >
          {disputeBanner && (
            <div className="flex items-center justify-between gap-4 bg-red-500/10 border-b border-red-500/30 px-6 py-3 text-sm">
              <div className="flex items-center gap-2 text-red-300">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  {disputeBanner.count === 1
                    ? `A client disputed a ${formatUsd(disputeBanner.totalAmountCents)} payment. Respond with evidence${
                        disputeBanner.evidenceDueBy
                          ? ` by ${formatDeadline(disputeBanner.evidenceDueBy)}`
                          : " as soon as possible"
                      } — if the dispute is lost, the amount comes out of your payouts.`
                    : `${disputeBanner.count} client payments are disputed (${formatUsd(disputeBanner.totalAmountCents)} total). Respond with evidence${
                        disputeBanner.evidenceDueBy
                          ? ` by ${formatDeadline(disputeBanner.evidenceDueBy)}`
                          : " as soon as possible"
                      } — if a dispute is lost, the amount comes out of your payouts.`}
                </span>
              </div>
              <button
                onClick={openStripeDashboard}
                disabled={disputeLinkLoading}
                className="shrink-0 font-medium text-red-300 underline underline-offset-2 hover:text-red-200 disabled:opacity-60"
              >
                {disputeLinkLoading ? "Opening…" : "Respond in Stripe"}
              </button>
            </div>
          )}
          {billingBanner && (
            <div className="flex items-center justify-between gap-4 bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 text-sm">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {billingBanner === "past_due"
                    ? "Payment issue — your last SAL payment failed. Update your card to avoid interruption."
                    : "Your SAL subscription is paused. It will resume automatically; manage it from billing."}
                </span>
              </div>
              <Link
                href="/settings?tab=billing"
                className="shrink-0 font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200"
              >
                {billingBanner === "past_due" ? "Update card" : "Manage billing"}
              </Link>
            </div>
          )}
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
              className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-gradient-to-b from-sal-500 to-sal-600 text-white shadow-glow flex items-center justify-center hover:from-sal-500 hover:to-sal-700 transition-all"
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
