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

const ACCENT = "#d7ff77"

/* ----------------------------------------------------------------- pieces --- */

function SalMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16 4c-2.5 0-4.5 1.2-5.8 3.1C8.9 8.9 8 11.3 8 14c0 3.5 1.5 6.5 4 8.5V26a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.5c2.5-2 4-5 4-8.5 0-2.7-.9-5.1-2.2-6.9C20.5 5.2 18.5 4 16 4z" />
    </svg>
  )
}

// Subtle film grain for warmth/depth — pure inline SVG, no global CSS.
function Grain() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>`
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] mix-blend-multiply"
      style={{ backgroundImage: `url("data:image/svg+xml,${svg}")` }}
    />
  )
}

// Diagonal barber-pole hairline — the signature accent.
function BarberStripe({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        backgroundImage: `repeating-linear-gradient(45deg, ${ACCENT} 0 10px, #034d3a 10px 20px, #faf8f3 20px 30px)`,
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
      <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[44px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(5,150,105,0.18),transparent)]" />
      <div className="overflow-hidden rounded-2xl border border-sal-950/10 bg-white shadow-[0_40px_120px_-30px_rgba(1,37,23,0.45)] sm:rounded-[26px]">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-sal-950/8 bg-cream-100/80 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-sal-950/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-sal-950/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-sal-950/15" />
          <div className="ml-3 hidden items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-sal-950/45 ring-1 ring-sal-950/8 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-sal-500" /> app.meetsal.ai
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_240px]">
          {/* sidebar — desktop only */}
          <aside className="hidden border-r border-sal-950/8 bg-cream-50 p-4 lg:block">
            <div className="mb-7 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sal-500 text-white">
                <SalMark className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <p className="font-heading text-sm font-bold text-sal-950">SAL Studio</p>
                <p className="text-[11px] text-sal-950/45">Main floor</p>
              </div>
            </div>
            {["Calendar", "Clients", "Checkout", "Messages", "Reports"].map((item, i) => (
              <div
                key={item}
                className={`mb-1.5 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  i === 0 ? "bg-sal-950 text-white" : "text-sal-950/55 hover:bg-sal-950/5"
                }`}
              >
                {item}
              </div>
            ))}
          </aside>

          {/* schedule — always visible */}
          <section className="bg-cream-50 p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sal-600">Tuesday · Today</p>
                <h3 className="mt-1 font-heading text-2xl font-bold tracking-tight text-sal-950">Chair schedule</h3>
              </div>
              <span className="rounded-full bg-sal-100 px-3 py-1.5 text-xs font-bold text-sal-700">12 booked</span>
            </div>

            <div className="space-y-2.5">
              {appointments.map((a) => (
                <div
                  key={a.time}
                  className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-2xl border border-sal-950/8 bg-white p-3.5"
                >
                  <span className="text-sm font-bold text-sal-950/45">{a.time}</span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-[15px] font-bold tracking-tight text-sal-950">{a.name}</p>
                    <p className="truncate text-[13px] text-sal-950/50">{a.service}</p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={
                      a.tone === "lime"
                        ? { background: ACCENT, color: "#0c3a2c" }
                        : a.tone === "mint"
                          ? { background: "#d1fae5", color: "#065f46" }
                          : { background: "#eeeee6", color: "#3f3f37" }
                    }
                  >
                    {a.tone === "cream" ? "Ready" : a.tone === "mint" ? "Checked in" : "Confirmed"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[["Revenue", "$2,840"], ["Tips", "$318"], ["Rebooked", "68%"]].map(([l, v]) => (
                <div key={l} className="rounded-2xl bg-sal-950 p-3.5 text-white">
                  <p className="text-[11px] text-white/55">{l}</p>
                  <p className="mt-1.5 font-heading text-xl font-bold tracking-tight">{v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* assistant rail — desktop only */}
          <aside className="hidden border-l border-sal-950/8 bg-white p-4 lg:block">
            <div className="rounded-2xl bg-sal-950 p-4 text-white">
              <Sparkles className="h-5 w-5" style={{ color: ACCENT }} />
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
                Ask SAL
              </p>
              <h4 className="mt-1.5 font-heading text-lg font-bold leading-snug tracking-tight">Fill the quiet hours.</h4>
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/65">
                14 regulars are overdue. 6 prefer Fridays. 3 usually add beard work.
              </p>
            </div>
            <div className="mt-3 rounded-2xl border border-sal-950/8 bg-cream-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sal-600">Checkout</p>
              <p className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-sal-950">$86.00</p>
              <p className="mt-0.5 text-[13px] text-sal-950/50">Cut · product · tip · commission</p>
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
    <main className="relative min-h-screen overflow-x-hidden bg-cream-50 font-sans text-sal-950 antialiased">
      <Grain />

      {/* ---- nav ---- */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-sal-950/8 bg-cream-50/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="SAL home">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sal-500 text-white shadow-sm shadow-sal-700/25">
              <SalMark />
            </span>
            <span className="font-heading text-xl font-bold tracking-tight">SAL</span>
          </Link>

          <div className="hidden items-center gap-9 md:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-semibold text-sal-950/55 transition hover:text-sal-950">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" className="rounded-full font-semibold text-sal-950 hover:bg-sal-950/5">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild className="group rounded-full bg-sal-950 px-5 font-semibold text-white hover:bg-sal-900">
              <Link href="/register">
                Open SAL
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-full border border-sal-950/10 p-2 md:hidden"
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-sal-950/8 bg-cream-50 px-4 py-4 md:hidden">
            <div className="grid gap-1.5">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-sal-950/70 hover:bg-sal-950/5"
                >
                  {l.label}
                </a>
              ))}
              <Button asChild className="mt-2 rounded-full bg-sal-950 font-semibold text-white">
                <Link href="/register">Open SAL</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* ---- hero ---- */}
      <section className="relative isolate overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        {/* atmosphere */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_-10%,#ffffff_0%,#f7f8f1_42%,#e9f5dd_100%)]" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.4]"
          style={{
            backgroundImage:
              "linear-gradient(#01251710 1px,transparent 1px),linear-gradient(90deg,#01251710 1px,transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(70% 55% at 50% 0%,#000 0%,transparent 80%)",
          }}
        />

        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-sal-950/10 bg-white/70 px-3.5 py-1.5 text-[13px] font-semibold text-sal-950/65 shadow-sm backdrop-blur"
          >
            <Scissors className="h-3.5 w-3.5 text-sal-600" />
            Booking software for barbers, salons & spas
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mx-auto max-w-3xl font-heading text-[clamp(2.7rem,7.5vw,5.5rem)] font-extrabold leading-[0.97] tracking-tight text-sal-950"
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
            className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-sal-950/60 sm:text-xl"
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
            <Button asChild size="lg" className="group h-12 rounded-full bg-sal-950 px-7 text-base font-semibold text-white hover:bg-sal-900">
              <Link href="/register">
                Start free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-sal-950/12 bg-white/70 px-7 text-base font-semibold text-sal-950 hover:bg-white">
              <a href="#product">See it live</a>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium text-sal-950/45"
          >
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" style={{ color: ACCENT, fill: ACCENT }} /> No card to start
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-sal-600" /> No double-bookings, guaranteed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-sal-600" /> Live in minutes
            </span>
          </motion.div>
        </div>
      </section>

      {/* ---- service marquee ---- */}
      <div className="relative border-y border-sal-950/8 bg-sal-950 py-4">
        <BarberStripe className="absolute inset-x-0 top-0 h-1" />
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <motion.div
            className="flex shrink-0 items-center gap-8 pr-8"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 26 }}
          >
            {[...marquee, ...marquee].map((s, i) => (
              <span key={i} className="flex shrink-0 items-center gap-8 font-heading text-sm font-semibold uppercase tracking-[0.18em] text-white/55">
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
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-sal-600">The whole shop, one screen</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight text-sal-950 sm:text-[2.75rem]">
            Built for real front-desk pressure.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-sal-950/55">
            Phones ringing, walk-ins waiting, barbers finishing — SAL keeps the
            whole floor calm and the money accounted for.
          </p>
        </div>
        <AppPreview />
      </section>

      {/* ---- features ---- */}
      <section id="features" className="border-t border-sal-950/8 bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl">
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-sal-600">Why shops switch</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight text-sal-950 sm:text-[2.75rem]">
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
                className="group relative overflow-hidden rounded-[28px] border border-sal-950/8 bg-cream-50 p-7 transition-all hover:-translate-y-1 hover:border-sal-950/15 hover:shadow-[0_24px_60px_-30px_rgba(1,37,23,0.4)]"
              >
                <span className="absolute right-6 top-6 font-heading text-5xl font-extrabold tracking-tight text-sal-950/[0.05] transition-colors group-hover:text-sal-500/20">
                  {f.no}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sal-950 text-white transition-colors group-hover:bg-sal-500">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 font-heading text-xl font-bold tracking-tight text-sal-950 sm:text-2xl">{f.title}</h3>
                <p className="mt-3 leading-relaxed text-sal-950/55">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- the day (dark band) ---- */}
      <section id="day" className="relative overflow-hidden bg-sal-950 px-4 py-20 text-white sm:px-6 sm:py-24 lg:px-8">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white/75">
              <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              A Tuesday, handled
            </div>
            <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.75rem]">
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
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7"
              >
                <s.icon className="h-6 w-6" style={{ color: ACCENT }} />
                <p className="mt-7 font-heading text-4xl font-extrabold tracking-tight">{s.value}</p>
                <p className="mt-1 font-semibold text-white/80">{s.label}</p>
                <p className="mt-1 text-sm text-white/45">{s.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[36px] bg-sal-950 px-7 py-12 text-white sm:px-12 sm:py-16">
          <BarberStripe className="absolute inset-y-0 right-0 w-16 opacity-90 sm:w-24" />
          <div className="relative max-w-xl">
            <p className="text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
              Ready when you are
            </p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Run your shop the calm way.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-white/60">
              Set up your chair, share your booking link, and watch the day run
              itself. Free to start — no card required.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="group h-12 rounded-full bg-white px-7 text-base font-bold text-sal-950 hover:bg-cream-100">
                <Link href="/register">
                  Open SAL
                  <ChevronRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-7 text-base font-semibold text-white hover:bg-white/10">
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- footer ---- */}
      <footer className="border-t border-sal-950/8 bg-cream-50 px-4 py-9 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-sal-950/50 sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-sal-950">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sal-500 text-white">
              <SalMark className="h-4 w-4" />
            </span>
            SAL Platform
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/terms" className="hover:text-sal-950">Terms</Link>
            <Link href="/privacy" className="hover:text-sal-950">Privacy</Link>
            <span>© 2026 SAL</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
