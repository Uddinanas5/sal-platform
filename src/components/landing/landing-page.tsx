"use client"

import Link from "next/link"
import { useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock,
  CreditCard,
  Menu,
  MessageCircle,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"

/* ------------------------------------------------------------------ data --- */

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "The day", href: "#day" },
]

const marquee = [
  "Skin fade", "Beard sculpt", "Hot towel", "Color & gloss", "Line up",
  "Blowout", "Kids cut", "Straight razor", "Balayage", "Scalp treatment",
]

const appointments = [
  { time: "9:00", name: "Marco V.", service: "Skin fade", tone: "lime" },
  { time: "10:15", name: "Devon R.", service: "Cut + beard", tone: "mint" },
  { time: "11:30", name: "Samir A.", service: "Deposit paid", tone: "cream" },
]

const features = [
  {
    no: "01",
    icon: CalendarDays,
    title: "Booking that respects the chair",
    body: "Online booking, walk-ins, staff schedules, deposits and live availability in one calm calendar — no double-books, ever.",
  },
  {
    no: "02",
    icon: Users,
    title: "Every client, remembered",
    body: "Cut notes, photos, preferences, visit history and spend stay attached to the profile so every visit feels personal.",
  },
  {
    no: "03",
    icon: CreditCard,
    title: "Checkout without the cleanup",
    body: "Cash, card, tips, products, deposits and commission tallied before the next client even sits down.",
  },
  {
    no: "04",
    icon: MessageCircle,
    title: "Messages that protect revenue",
    body: "Automatic reminders, confirmations and rebooking nudges quietly cut no-shows while you keep cutting.",
  },
]

const dayStats = [
  { icon: CalendarDays, value: "12", label: "booked today", sub: "3 walk-ins absorbed" },
  { icon: TrendingUp, value: "$2,840", label: "tracked revenue", sub: "+$318 in tips" },
  { icon: Bell, value: "68%", label: "rebooked on exit", sub: "reminders sent on autopilot" },
]

const ACCENT = "#4fe6a6"

/* ----------------------------------------------------------------- pieces --- */

function SalMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16 4c-2.5 0-4.5 1.2-5.8 3.1C8.9 8.9 8 11.3 8 14c0 3.5 1.5 6.5 4 8.5V26a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.5c2.5-2 4-5 4-8.5 0-2.7-.9-5.1-2.2-6.9C20.5 5.2 18.5 4 16 4z" />
    </svg>
  )
}

// Diagonal barber-pole hairline — the signature accent.
function BarberStripe({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        backgroundImage: `repeating-linear-gradient(45deg, ${ACCENT} 0 10px, #034d3a 10px 20px, rgba(255,255,255,0.92) 20px 30px)`,
      }}
    />
  )
}

/** The product preview — IN NORMAL FLOW, responsive, always populated on mobile. */
function AppPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-5xl"
    >
      {/* glow */}
      <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[44px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(79,230,166,0.14),transparent)]" />
      <div className="glass-panel overflow-hidden rounded-2xl sm:rounded-[26px]">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <div className="glass-pill ml-3 hidden items-center gap-2 px-3 py-1 text-xs font-medium text-ink-faint sm:flex">
            <span className="led led-mint" /> app.meetsal.ai
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_240px]">
          {/* sidebar — desktop only */}
          <aside className="hidden border-r border-white/10 bg-white/[0.03] p-4 lg:block">
            <div className="mb-7 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sal-500 text-white">
                <SalMark className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <p className="font-heading text-sm font-bold text-ink">SAL Studio</p>
                <p className="text-[11px] text-ink-faint">Main floor</p>
              </div>
            </div>
            {["Calendar", "Clients", "Checkout", "Messages", "Reports"].map((item, i) => (
              <div
                key={item}
                className={`mb-1.5 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  i === 0 ? "glass-tile text-ink" : "text-ink-faint hover:bg-white/5"
                }`}
              >
                {item}
              </div>
            ))}
          </aside>

          {/* schedule — always visible */}
          <section className="p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-mint">Tuesday · Today</p>
                <h3 className="mt-1 font-heading text-2xl font-bold tracking-tight text-ink">Chair schedule</h3>
              </div>
              <span className="rounded-full bg-sal-100 px-3 py-1.5 text-xs font-bold text-mint">12 booked</span>
            </div>

            <div className="space-y-2.5">
              {appointments.map((a) => (
                <div
                  key={a.time}
                  className="glass-tile grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-2xl p-3.5"
                >
                  <span className="text-sm font-bold text-ink-faint">{a.time}</span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-[15px] font-bold tracking-tight text-ink">{a.name}</p>
                    <p className="truncate text-[13px] text-ink-soft">{a.service}</p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={
                      a.tone === "lime"
                        ? { background: ACCENT, color: "#0c3a2c" }
                        : a.tone === "mint"
                          ? { background: "rgba(79,230,166,0.18)", color: "#8aeec6" }
                          : { background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }
                    }
                  >
                    {a.tone === "cream" ? "Ready" : a.tone === "mint" ? "Checked in" : "Confirmed"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[["Revenue", "$2,840"], ["Tips", "$318"], ["Rebooked", "68%"]].map(([l, v]) => (
                <div key={l} className="glass-tile rounded-2xl p-3.5 text-ink">
                  <p className="text-[11px] text-ink-faint">{l}</p>
                  <p className="mt-1.5 font-heading text-xl font-bold tracking-tight">{v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* assistant rail — desktop only */}
          <aside className="hidden border-l border-white/10 bg-white/[0.03] p-4 lg:block">
            <div className="glass-tile rounded-2xl p-4 text-ink">
              <Sparkles className="h-5 w-5" style={{ color: ACCENT }} />
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
                Ask SAL
              </p>
              <h4 className="mt-1.5 font-heading text-lg font-bold leading-snug tracking-tight">Fill the quiet hours.</h4>
              <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
                14 regulars are overdue. 6 prefer Fridays. 3 usually add beard work.
              </p>
            </div>
            <div className="glass-tile mt-3 rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-mint">Checkout</p>
              <p className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-ink">$86.00</p>
              <p className="mt-0.5 text-[13px] text-ink-soft">Cut · product · tip · commission</p>
            </div>
          </aside>
        </div>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------- page --- */

export default function LandingPage() {
  const [open, setOpen] = useState(false)

  return (
    <main className="env-canvas env-grain relative min-h-screen overflow-x-hidden font-sans text-ink antialiased">
      {/* ---- nav ---- */}
      <nav className="surface-glass fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="SAL home">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sal-500 text-white shadow-glow-sm">
              <SalMark />
            </span>
            <span className="font-heading text-xl font-bold tracking-tight text-ink">SAL</span>
          </Link>

          <div className="hidden items-center gap-9 md:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-semibold text-ink-soft transition hover:text-ink">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" className="rounded-full font-semibold text-ink hover:bg-white/10">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild className="group rounded-full px-5 font-semibold">
              <Link href="/register">
                Open SAL
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-ink md:hidden"
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-white/10 px-4 py-4 md:hidden">
            <div className="grid gap-1.5">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-white/10"
                >
                  {l.label}
                </a>
              ))}
              <Button asChild className="mt-2 h-11 rounded-full font-semibold">
                <Link href="/register">Open SAL</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* ---- hero ---- */}
      <section className="relative isolate overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        {/* atmosphere */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(70% 55% at 50% 0%,#000 0%,transparent 80%)",
          }}
        />

        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-pill mx-auto mb-7 inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft"
          >
            <Scissors className="h-3.5 w-3.5 text-mint" />
            Booking software for barbers, salons & spas
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="hero-title mx-auto max-w-3xl text-[clamp(2.7rem,7.5vw,5.5rem)] leading-[0.97] text-ink"
          >
            The calm way to
            <br className="hidden sm:block" /> run a{" "}
            <span className="relative whitespace-nowrap">
              busy chair
              <svg
                viewBox="0 0 300 18"
                className="absolute -bottom-2 left-0 h-3 w-full"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M3 13 C 80 4, 220 4, 297 11"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="hero-sub mx-auto mt-7 max-w-xl text-lg leading-relaxed sm:text-xl"
          >
            Bookings, clients, checkout, reminders and daily revenue — in one
            workspace that finally feels as sharp as your shop.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="group h-12 rounded-full px-7 text-base font-semibold">
              <Link href="/register">
                Start free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="glass" className="h-12 rounded-full px-7 text-base font-semibold">
              <a href="#product">See it live</a>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium text-ink-faint"
          >
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" style={{ color: ACCENT, fill: ACCENT }} /> No card to start
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-mint" /> No double-bookings, guaranteed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-mint" /> Live in minutes
            </span>
          </motion.div>
        </div>
      </section>

      {/* ---- service marquee ---- */}
      <div className="relative border-y border-white/10 bg-sal-950/60 py-4">
        <BarberStripe className="absolute inset-x-0 top-0 h-1" />
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <motion.div
            className="flex shrink-0 items-center gap-8 pr-8"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 26 }}
          >
            {[...marquee, ...marquee].map((s, i) => (
              <span key={i} className="flex shrink-0 items-center gap-8 font-heading text-sm font-semibold uppercase tracking-[0.18em] text-ink-faint">
                {s}
                <Scissors className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              </span>
            ))}
          </motion.div>
        </div>
        <BarberStripe className="absolute inset-x-0 bottom-0 h-1" />
      </div>

      {/* ---- product preview ---- */}
      <section id="product" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">The whole shop, one screen</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-[2.75rem]">
            Built for real front-desk pressure.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-ink-soft">
            Phones ringing, walk-ins waiting, barbers finishing — SAL keeps the
            whole floor calm and the money accounted for.
          </p>
        </div>
        <AppPreview />
      </section>

      {/* ---- features ---- */}
      <section id="features" className="border-t border-white/10 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">Why shops switch</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-[2.75rem]">
              Premium on the surface. Serious underneath.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="glass-tile group relative overflow-hidden rounded-[28px] p-7 transition-all hover:-translate-y-1 hover:brightness-110"
              >
                <span className="absolute right-6 top-6 font-heading text-5xl font-extrabold tracking-tight text-white/[0.06] transition-colors group-hover:text-mint/20">
                  {f.no}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sal-500 text-white shadow-glow-sm transition-colors group-hover:bg-sal-400">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">{f.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- the day (dark band) ---- */}
      <section id="day" className="relative overflow-hidden border-t border-white/10 px-4 py-20 text-ink sm:px-6 sm:py-24 lg:px-8">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 opacity-[0.05]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl">
            <div className="glass-pill mb-5 inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft">
              <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              A Tuesday, handled
            </div>
            <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-[2.75rem]">
              What a calm day looks like.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {dayStats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="glass-tile rounded-[28px] p-7"
              >
                <s.icon className="h-6 w-6" style={{ color: ACCENT }} />
                <p className="mt-7 font-heading text-4xl font-extrabold tracking-tight text-ink">{s.value}</p>
                <p className="mt-1 font-semibold text-ink-soft">{s.label}</p>
                <p className="mt-1 text-sm text-ink-faint">{s.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="glass-panel relative mx-auto max-w-5xl overflow-hidden rounded-[36px] px-7 py-12 text-ink sm:px-12 sm:py-16">
          <BarberStripe className="absolute inset-y-0 right-0 w-16 opacity-90 sm:w-24" />
          <div className="relative max-w-xl">
            <p className="text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
              Ready when you are
            </p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              Run your shop the calm way.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
              Set up your chair, share your booking link, and watch the day run
              itself. Free to start — no card required.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="group h-12 rounded-full px-7 text-base font-bold">
                <Link href="/register">
                  Open SAL
                  <ChevronRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-7 text-base font-semibold text-ink hover:bg-white/10">
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- footer ---- */}
      <footer className="px-4 pb-9 sm:px-6 lg:px-8">
        <div className="hairline-fade mb-9" />
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-ink-faint sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sal-500 text-white">
              <SalMark className="h-4 w-4" />
            </span>
            SAL Platform
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/terms" className="py-3 transition hover:text-ink">Terms</Link>
            <Link href="/privacy" className="py-3 transition hover:text-ink">Privacy</Link>
            <span>© 2026 SAL</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
