"use client"

import { useRef } from "react"
import Link from "next/link"
import { motion, useInView } from "framer-motion"
import {
  CalendarDays,
  Users,
  Globe,
  UserCheck,
  ShoppingBag,
  BarChart3,
  Check,
  ArrowRight,
  Sparkles,
  Clock,
  Star,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// ---------------------------------------------------------------------------
// Animated wrapper -- fades + slides children into view on scroll
// ---------------------------------------------------------------------------
function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// SAL owl logo SVG (reused from login page)
// ---------------------------------------------------------------------------
function SalLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor">
      <path d="M16 4c-2.5 0-4.5 1.2-5.8 3.1C8.9 8.9 8 11.3 8 14c0 3.5 1.5 6.5 4 8.5V26a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.5c2.5-2 4-5 4-8.5 0-2.7-.9-5.1-2.2-6.9C20.5 5.2 18.5 4 16 4z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Dashboard mockup — a decorative gradient card with faux calendar lines
// ---------------------------------------------------------------------------
function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      {/* Glow behind the card */}
      <div className="absolute -inset-4 bg-gradient-to-r from-sal-400/20 via-sal-500/10 to-sal-300/20 blur-3xl rounded-3xl" />
      <div className="relative rounded-2xl border border-cream-200 dark:border-sal-800/40 bg-white dark:bg-sal-900/60 shadow-2xl shadow-sal-500/10 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-cream-200 dark:border-sal-800/40 bg-cream-50 dark:bg-sal-900/80">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-md bg-cream-100 dark:bg-sal-800/50 text-xs text-muted-foreground font-mono">
              app.salplatform.com/dashboard
            </div>
          </div>
        </div>
        {/* Content area */}
        <div className="p-6 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Today", value: "12", color: "bg-sal-500/10 dark:bg-sal-500/20 text-sal-700 dark:text-sal-300" },
              { label: "Clients", value: "248", color: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300" },
              { label: "Revenue", value: "$3.2k", color: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" },
              { label: "Rating", value: "4.9", color: "bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-xl p-3 text-center ${stat.color}`}
              >
                <div className="text-lg font-bold font-heading">{stat.value}</div>
                <div className="text-[10px] opacity-70">{stat.label}</div>
              </div>
            ))}
          </div>
          {/* Calendar lines */}
          <div className="space-y-2">
            {[
              { time: "9:00 AM", name: "Sarah M. — Haircut & Style", w: "w-3/4", color: "bg-sal-500" },
              { time: "10:30 AM", name: "James R. — Beard Trim", w: "w-1/2", color: "bg-blue-500" },
              { time: "11:00 AM", name: "Emily K. — Color Treatment", w: "w-5/6", color: "bg-amber-500" },
              { time: "1:00 PM", name: "Lisa T. — Facial", w: "w-2/3", color: "bg-purple-500" },
            ].map((appt) => (
              <div key={appt.time} className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-16 text-right font-mono shrink-0">
                  {appt.time}
                </span>
                <div
                  className={`${appt.w} ${appt.color} rounded-lg px-3 py-2 text-white text-xs font-medium`}
                >
                  {appt.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------
const features = [
  {
    icon: CalendarDays,
    title: "Calendar & Scheduling",
    description:
      "Day, week, and month views with drag-to-reschedule. See your entire team's schedule at a glance.",
  },
  {
    icon: Users,
    title: "Client Management",
    description:
      "Full client profiles with visit history, preferences, notes, and loyalty tracking built in.",
  },
  {
    icon: Globe,
    title: "Online Booking",
    description:
      "A beautiful booking page your clients can access 24/7. Share the link or embed it on your site.",
  },
  {
    icon: UserCheck,
    title: "Staff Management",
    description:
      "Manage schedules, breaks, commissions, and performance for your entire team.",
  },
  {
    icon: ShoppingBag,
    title: "Inventory & POS",
    description:
      "Track product stock, set low-stock alerts, and process payments — all from one screen.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description:
      "Revenue, retention, staff performance, and more. Export to CSV or view interactive charts.",
  },
]

// ---------------------------------------------------------------------------
// Steps data
// ---------------------------------------------------------------------------
const steps = [
  {
    number: "01",
    icon: Sparkles,
    title: "Sign up and add your services",
    description:
      "Create your account in seconds. Add your services, pricing, and team members to get set up.",
  },
  {
    number: "02",
    icon: Globe,
    title: "Share your booking link",
    description:
      "Give clients your unique booking URL so they can self-schedule appointments anytime.",
  },
  {
    number: "03",
    icon: Clock,
    title: "Manage everything from one dashboard",
    description:
      "Calendar, clients, inventory, payments, and reports — all in one beautiful interface.",
  },
]

// ---------------------------------------------------------------------------
// Pricing features
// ---------------------------------------------------------------------------
const pricingFeatures = [
  "Unlimited appointments",
  "Online booking page",
  "Client management",
  "Staff scheduling",
  "Inventory tracking",
  "Reports & analytics",
  "Email notifications",
]

// ---------------------------------------------------------------------------
// Nav links for smooth scroll
// ---------------------------------------------------------------------------
const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
]

// ===========================================================================
// Landing page component
// ===========================================================================
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-cream dark:bg-background overflow-x-hidden">
      {/* ================================================================= */}
      {/* NAVIGATION                                                        */}
      {/* ================================================================= */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-cream/80 dark:bg-background/80 border-b border-cream-200 dark:border-sal-800/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-sal-500 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:shadow-sal-500/20 transition-all">
                <SalLogo className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading font-bold text-xl text-foreground">
                SAL
              </span>
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/login">
                  Get Started Free
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-sal-800/40 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Mobile dropdown */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden pb-4 space-y-2"
            >
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-cream-200 dark:hover:bg-sal-800/40 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2 space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button className="w-full" asChild>
                  <Link href="/login">Get Started Free</Link>
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </nav>

      {/* ================================================================= */}
      {/* HERO                                                              */}
      {/* ================================================================= */}
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-32">
        {/* Decorative gradient blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-sal-400/10 dark:bg-sal-500/5 rounded-full blur-3xl" />
          <div className="absolute top-20 -left-40 w-80 h-80 bg-sal-300/10 dark:bg-sal-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-sal-200 dark:border-sal-700/40 bg-sal-50 dark:bg-sal-500/10 px-4 py-1.5 text-sm text-sal-700 dark:text-sal-300 mb-6">
                <Star className="h-3.5 w-3.5 fill-sal-500 text-sal-500" />
                Free to get started — no credit card required
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-tight tracking-tight"
            >
              The All-in-One Platform for{" "}
              <span className="text-sal-500">Salons & Spas</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              Manage appointments, clients, staff, and payments — all in one
              beautiful dashboard. Free to get started.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button size="lg" asChild className="text-base px-8 h-12">
                <Link href="/login">
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="text-base px-8 h-12"
              >
                <Link href="/login">See Demo</Link>
              </Button>
            </motion.div>
          </div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* FEATURES                                                          */}
      {/* ================================================================= */}
      <section id="features" className="py-20 sm:py-28 bg-white dark:bg-sal-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground">
              Everything you need to run your business
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful tools designed specifically for salons, spas, and wellness
              businesses.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <AnimatedSection key={feature.title} delay={index * 0.1}>
                <Card className="h-full border-cream-200 dark:border-sal-800/40 hover:shadow-lg hover:shadow-sal-500/5 transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-sal-500/10 dark:bg-sal-500/20 flex items-center justify-center mb-4 group-hover:bg-sal-500/20 dark:group-hover:bg-sal-500/30 transition-colors">
                      <feature.icon className="h-6 w-6 text-sal-600 dark:text-sal-400" />
                    </div>
                    <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* HOW IT WORKS                                                       */}
      {/* ================================================================= */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground">
              Up and running in minutes
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Getting started with SAL takes three simple steps.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <AnimatedSection key={step.number} delay={index * 0.15}>
                <div className="relative text-center">
                  {/* Connector line (desktop only) */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-10 left-[60%] w-[80%] border-t-2 border-dashed border-cream-300 dark:border-sal-800/40" />
                  )}
                  <div className="relative z-10 mx-auto w-20 h-20 rounded-2xl bg-sal-500/10 dark:bg-sal-500/20 flex items-center justify-center mb-6">
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-sal-500 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                      {step.number}
                    </span>
                    <step.icon className="h-8 w-8 text-sal-600 dark:text-sal-400" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    {step.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* PRICING                                                           */}
      {/* ================================================================= */}
      <section id="pricing" className="py-20 sm:py-28 bg-white dark:bg-sal-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Start for free. No credit card required. Upgrade when you are ready.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={0.1} className="flex justify-center">
            <Card className="w-full max-w-md border-sal-200 dark:border-sal-700/40 shadow-xl shadow-sal-500/5 relative overflow-hidden">
              {/* Popular ribbon */}
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-sal-500 px-3 py-1 text-xs font-semibold text-white">
                  <Star className="h-3 w-3 fill-white" />
                  Free Forever
                </span>
              </div>
              <CardContent className="p-8">
                <div className="mb-8">
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    Starter
                  </h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-5xl font-heading font-bold text-foreground">
                      $0
                    </span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Everything you need to get started
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {pricingFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-sal-500/10 dark:bg-sal-500/20 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-sal-600 dark:text-sal-400" />
                      </div>
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button className="w-full h-12 text-base" asChild>
                  <Link href="/login">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </section>

      {/* ================================================================= */}
      {/* CTA BANNER                                                        */}
      {/* ================================================================= */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="relative rounded-3xl bg-gradient-to-br from-sal-600 to-sal-700 dark:from-sal-700 dark:to-sal-900 p-12 sm:p-16 text-center overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl font-heading font-bold text-white mb-4">
                  Ready to transform your business?
                </h2>
                <p className="text-sal-100 text-lg max-w-xl mx-auto mb-8">
                  Join thousands of salons and spas already using SAL to grow their
                  business.
                </p>
                <Button
                  size="lg"
                  asChild
                  className="bg-white text-sal-700 hover:bg-cream-50 hover:text-sal-800 shadow-lg h-12 px-8 text-base"
                >
                  <Link href="/login">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ================================================================= */}
      {/* FOOTER                                                            */}
      {/* ================================================================= */}
      <footer className="border-t border-cream-200 dark:border-sal-800/40 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Logo & copyright */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-sal-500 rounded-lg flex items-center justify-center">
                  <SalLogo className="w-4 h-4 text-white" />
                </div>
                <span className="font-heading font-bold text-foreground">SAL</span>
              </Link>
              <span className="text-sm text-muted-foreground">
                &copy; 2026 SAL Platform. All rights reserved.
              </span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/terms"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <a
                href="mailto:hello@salplatform.com"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                hello@salplatform.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
