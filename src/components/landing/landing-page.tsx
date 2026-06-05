"use client"

import Link from "next/link"
import { useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  Menu,
  MessageCircle,
  Scissors,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Launch", href: "#launch" },
]

const appointments = [
  { time: "9:00", name: "Marco V.", service: "Skin fade", status: "Confirmed" },
  { time: "10:15", name: "Devon R.", service: "Cut + beard", status: "Checked in" },
  { time: "11:30", name: "Samir A.", service: "Deposit paid", status: "Ready" },
]

const features = [
  {
    icon: CalendarDays,
    title: "Booking that respects the chair",
    body: "Online booking, walk-ins, staff schedules, deposits, and availability live in one clean calendar.",
  },
  {
    icon: Users,
    title: "Client memory",
    body: "Cut notes, preferences, visit history, spend, and reminders stay attached to every client profile.",
  },
  {
    icon: CreditCard,
    title: "Checkout without cleanup",
    body: "Track card, cash, tips, products, deposits, and commission before the next client sits down.",
  },
  {
    icon: MessageCircle,
    title: "Messages that protect revenue",
    body: "Send reminders, confirmations, rebooking nudges, and no-show prevention from the same workflow.",
  },
]

const launchItems = [
  "Production data stays protected",
  "Local work uses the Supabase dev sandbox",
  "Fake actions are labeled before launch",
  "Payroll and checkout math are verified",
]

const productStats = [
  { label: "Today", value: "12 bookings", icon: CalendarDays },
  { label: "Clients", value: "36 beta profiles", icon: Users },
  { label: "Revenue", value: "$2.8k tracked", icon: BarChart3 },
]

function SalMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M16 4c-2.5 0-4.5 1.2-5.8 3.1C8.9 8.9 8 11.3 8 14c0 3.5 1.5 6.5 4 8.5V26a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.5c2.5-2 4-5 4-8.5 0-2.7-.9-5.1-2.2-6.9C20.5 5.2 18.5 4 16 4z" />
    </svg>
  )
}

function ProductScene() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[-180px] mx-auto hidden max-w-6xl px-6 md:block">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        className="mx-auto overflow-hidden rounded-[34px] border border-white/55 bg-white/70 shadow-[0_34px_120px_rgba(6,47,35,0.28)] backdrop-blur-xl"
      >
        <div className="grid min-h-[420px] grid-cols-[240px_1fr_300px]">
          <aside className="border-r border-emerald-950/10 bg-white/55 p-5">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <SalMark />
              </div>
              <div>
                <p className="font-heading text-sm font-bold text-emerald-950">SAL Studio</p>
                <p className="text-xs text-emerald-950/50">Main floor</p>
              </div>
            </div>
            {["Calendar", "Clients", "Checkout", "Messages", "Reports"].map((item, index) => (
              <div
                key={item}
                className={`mb-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                  index === 0 ? "bg-emerald-950 text-white shadow-lg shadow-emerald-950/15" : "text-emerald-950/62"
                }`}
              >
                {item}
              </div>
            ))}
          </aside>

          <section className="bg-[#fbfaf5] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Today</p>
                <h2 className="mt-1 font-heading text-3xl font-semibold tracking-normal text-emerald-950">
                  Chair schedule
                </h2>
              </div>
              <div className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">
                12 booked
              </div>
            </div>

            <div className="space-y-3">
              {appointments.map((appointment) => (
                <div
                  key={appointment.time}
                  className="grid grid-cols-[64px_1fr_auto] items-center gap-4 rounded-3xl border border-emerald-950/8 bg-white p-4 shadow-sm"
                >
                  <div className="text-sm font-bold text-emerald-950/55">{appointment.time}</div>
                  <div>
                    <p className="font-heading text-lg font-semibold tracking-normal text-emerald-950">
                      {appointment.name}
                    </p>
                    <p className="text-sm text-emerald-950/52">{appointment.service}</p>
                  </div>
                  <span className="rounded-full bg-[#e6f7d8] px-3 py-1 text-xs font-bold text-emerald-900">
                    {appointment.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["Revenue", "$2,840"],
                ["Tips", "$318"],
                ["Rebooked", "68%"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-3xl bg-emerald-950 p-4 text-white">
                  <p className="text-xs text-white/55">{label}</p>
                  <p className="mt-2 font-heading text-2xl font-semibold tracking-normal">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="border-l border-emerald-950/10 bg-white/65 p-5">
            <div className="rounded-[26px] bg-emerald-950 p-5 text-white">
              <Sparkles className="h-6 w-6 text-[#d7ff77]" />
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#d7ff77]">Ask SAL</p>
              <h3 className="mt-2 font-heading text-2xl font-semibold leading-tight tracking-normal">
                Fill the quiet hours.
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-white/68">
                14 regulars are overdue. 6 prefer Friday. 3 usually book beard work.
              </p>
            </div>
            <div className="mt-4 rounded-[26px] border border-emerald-950/10 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Checkout</p>
              <p className="mt-2 font-heading text-3xl font-semibold tracking-normal text-emerald-950">$86.00</p>
              <p className="mt-1 text-sm text-emerald-950/55">Cut, product, tip, commission</p>
            </div>
          </aside>
        </div>
      </motion.div>
    </div>
  )
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbfaf5] text-emerald-950">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-emerald-950/8 bg-[#fbfaf5]/78 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="SAL home">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-700/20">
              <SalMark />
            </span>
            <span className="font-heading text-xl font-semibold tracking-normal">SAL</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-semibold text-emerald-950/58 transition hover:text-emerald-950">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Button asChild variant="ghost" className="rounded-full text-emerald-950 hover:bg-emerald-950/5">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild className="rounded-full bg-emerald-950 px-5 text-white hover:bg-emerald-800">
              <Link href="/login">
                Open SAL
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-full border border-emerald-950/10 p-2 md:hidden"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-emerald-950/8 bg-[#fbfaf5] px-4 py-4 md:hidden">
            <div className="grid gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-emerald-950/70 hover:bg-emerald-950/5"
                >
                  {link.label}
                </a>
              ))}
              <Button asChild className="mt-2 rounded-full bg-emerald-950 text-white">
                <Link href="/login">Open SAL</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      <section className="relative min-h-[860px] overflow-hidden bg-[radial-gradient(circle_at_50%_18%,#ffffff_0%,#fbfaf5_36%,#edf7e5_100%)] pt-28 md:min-h-[820px]">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0))]" />
        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-950/10 bg-white/70 px-4 py-2 text-sm font-semibold text-emerald-950/70 shadow-sm backdrop-blur">
              <Scissors className="h-4 w-4 text-emerald-700" />
              For modern salons, barbers, and spa teams
            </div>
            <h1 className="mx-auto max-w-4xl font-heading text-[clamp(3.1rem,8vw,6.9rem)] font-semibold leading-[0.95] tracking-normal text-emerald-950">
              The calm way to run a busy shop.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-emerald-950/62 sm:text-xl">
              SAL brings bookings, clients, checkout, reminders, staff, and daily revenue into one polished workspace.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full bg-emerald-950 px-7 text-base text-white hover:bg-emerald-800">
                <Link href="/login">
                  Start with SAL
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-emerald-950/12 bg-white/70 px-7 text-base text-emerald-950 hover:bg-white">
                <a href="#product">See product</a>
              </Button>
            </div>
          </motion.div>
        </div>
        <ProductScene />
      </section>

      <section id="product" className="border-y border-emerald-950/8 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Product first</p>
            <h2 className="mt-4 font-heading text-4xl font-semibold leading-tight tracking-normal text-emerald-950 sm:text-5xl">
              Every daily workflow, in one place.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-emerald-950/58">
              Designed for real front-desk pressure: phones ringing, walk-ins waiting, barbers finishing, and clients needing a smooth checkout.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {productStats.map((stat) => (
              <div key={stat.label} className="rounded-[28px] border border-emerald-950/8 bg-[#fbfaf5] p-5">
                <stat.icon className="h-6 w-6 text-emerald-700" />
                <p className="mt-8 text-sm font-semibold text-emerald-950/45">{stat.label}</p>
                <p className="mt-1 font-heading text-2xl font-semibold tracking-normal text-emerald-950">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#fbfaf5] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Built for launch</p>
            <h2 className="mt-4 font-heading text-4xl font-semibold leading-tight tracking-normal text-emerald-950 sm:text-5xl">
              Premium on the surface. Serious underneath.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-[32px] border border-emerald-950/8 bg-white p-6 shadow-sm shadow-emerald-950/5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-7 font-heading text-2xl font-semibold tracking-normal text-emerald-950">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-relaxed text-emerald-950/58">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="launch" className="bg-emerald-950 py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm font-semibold text-white/70">
              <ShieldCheck className="h-4 w-4 text-[#d7ff77]" />
              Database-safe workflow
            </div>
            <h2 className="font-heading text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
              Experiment locally. Protect what is live.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/58">
              The landing page can move fast, but production data should stay boring, guarded, and untouched unless you explicitly approve it.
            </p>
          </div>

          <div className="rounded-[34px] bg-white p-3 text-emerald-950">
            {launchItems.map((item) => (
              <div key={item} className="flex items-center gap-4 rounded-[26px] px-4 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d7ff77] text-emerald-950">
                  <Check className="h-4 w-4" />
                </span>
                <p className="font-semibold">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[36px] bg-[#edf7e5] p-7 sm:flex-row sm:items-center sm:p-9">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">Ready to test</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-normal text-emerald-950">
              Open SAL and feel the calmer direction.
            </h2>
          </div>
          <Button asChild className="rounded-full bg-emerald-950 px-6 text-white hover:bg-emerald-800">
            <Link href="/login">
              Open app
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-emerald-950/8 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-sm text-emerald-950/56 sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-emerald-950">
            <SalMark />
            SAL Platform
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/terms" className="hover:text-emerald-950">Terms</Link>
            <Link href="/privacy" className="hover:text-emerald-950">Privacy</Link>
            <span>2026</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
