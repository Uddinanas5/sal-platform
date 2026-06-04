"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { motion, useInView } from "framer-motion"
import { ArrowRight, Plus, Menu, X } from "lucide-react"

// ===========================================================================
// SAL — brutalist barbershop OS landing page.
// Aesthetic: raw studio brutalism. Near-black + bone-white, ACID GREEN accent
// (#00E676). Heavy grotesque (Archivo Black) display + Space Mono technical
// type. Thick rules, hard edges, exposed grid, invert-on-hover, a scrolling
// tape. Honest: what's LIVE now vs the AI crew (EARLY ACCESS / building).
// ===========================================================================

const DISPLAY = "font-[family-name:var(--font-archivo)] font-black uppercase tracking-tight"

// --- Reveal on scroll -------------------------------------------------------
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// --- Owl mark ---------------------------------------------------------------
function Owl({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden>
      <path d="M16 4c-2.5 0-4.5 1.2-5.8 3.1C8.9 8.9 8 11.3 8 14c0 3.5 1.5 6.5 4 8.5V26a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.5c2.5-2 4-5 4-8.5 0-2.7-.9-5.1-2.2-6.9C20.5 5.2 18.5 4 16 4z" />
    </svg>
  )
}

// --- Scrolling tape ---------------------------------------------------------
function Tape({ dark = false }: { dark?: boolean }) {
  const items = ["RUN THE CHAIR", "NOT THE FRONT DESK", "BUILT BY A BARBER", "BOOK · MANAGE · GROW", "SAL"]
  return (
    <div className={`overflow-hidden border-y-2 ${dark ? "bg-[#00E676] text-black border-black" : "bg-black text-[#00E676] border-[#00E676]"}`}>
      <motion.div
        className="flex whitespace-nowrap py-2.5"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 24, ease: "linear", repeat: Infinity }}
      >
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0">
            {items.concat(items).map((t, i) => (
              <span key={`${dup}-${i}`} className="flex items-center text-xs sm:text-sm font-bold tracking-[0.2em] px-5">
                {t} <span className="px-5 opacity-60">✦</span>
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// --- Data -------------------------------------------------------------------
const liveFeatures = [
  { n: "01", t: "BOOKING CALENDAR", d: "Day / week views. Drag to move an appointment. Double-booking the same chair? Mathematically impossible." },
  { n: "02", t: "ONLINE BOOKING", d: "Your own link. Clients book themselves 24/7. It respects your hours, breaks, and days off — no ghost slots." },
  { n: "03", t: "CLIENT LIST", d: "Every client, every visit, every note. See who's loyal and who's slipping before they're gone." },
  { n: "04", t: "STAFF + CHAIRS", d: "Each barber's book, schedule, breaks and time off — locked tight to their own column." },
  { n: "05", t: "CHECKOUT", d: "Ring up cash sales and keep the receipts straight. Card payments: wiring up next." },
  { n: "06", t: "REPORTS", d: "Your numbers, no spin. Revenue, retention, no-shows, who actually shows up." },
]

const crew = [
  { t: "ASK SAL", d: "Talk to your shop. “Who hasn't come in two months?” → it answers, from your real data.", tag: "EARLY ACCESS" },
  { t: "THE FRONT DESK", d: "Books, reschedules, and fills last-minute cancellations on its own. 24/7.", tag: "COMING" },
  { t: "THE WIN-BACK", d: "Spots the regular who ghosted you and texts him back. Runs the slow-day offers.", tag: "COMING" },
  { t: "THE MANAGER", d: "Watches your numbers and tells you straight: raise your prices, Saturday's maxed.", tag: "COMING" },
]

const steps = [
  { n: "01", t: "LOAD YOUR SHOP", d: "Sign up, drop in your services, prices, and barbers. Minutes, not a manual." },
  { n: "02", t: "DROP YOUR LINK", d: "Share your booking link. Clients self-book. Your phone stops blowing up." },
  { n: "03", t: "RUN THE FLOOR", d: "Calendar, clients, checkout, numbers — one screen. You stay on the chair." },
]

// --- Buttons ----------------------------------------------------------------
function PrimaryBtn({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-2 bg-[#00E676] text-black border-2 border-black px-6 py-3.5 text-sm font-bold uppercase tracking-widest shadow-[5px_5px_0_0_#000] transition-all hover:shadow-none hover:translate-x-[5px] hover:translate-y-[5px] ${className}`}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

function GhostBtn({ href, children, dark = false, className = "" }: { href: string; children: React.ReactNode; dark?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 border-2 px-6 py-3.5 text-sm font-bold uppercase tracking-widest transition-colors ${
        dark
          ? "border-[#00E676] text-[#00E676] hover:bg-[#00E676] hover:text-black"
          : "border-black text-black hover:bg-black hover:text-[#ece9e0]"
      } ${className}`}
    >
      {children}
    </Link>
  )
}

// ===========================================================================
export default function LandingPage() {
  const [menu, setMenu] = useState(false)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ece9e0] font-[family-name:var(--font-space-mono)] selection:bg-[#00E676] selection:text-black overflow-x-hidden">
      {/* ===== NAV ========================================================= */}
      <header className="sticky top-0 z-50 border-b-2 border-[#00E676] bg-[#0a0a0a]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center border-2 border-[#00E676] bg-[#00E676] text-black">
                <Owl className="h-5 w-5" />
              </span>
              <span className={`${DISPLAY} text-2xl leading-none`}>SAL</span>
            </Link>

            <nav className="hidden items-center gap-8 text-xs uppercase tracking-widest md:flex">
              {[["What's Live", "#live"], ["AI Crew", "#crew"], ["Access", "#access"]].map(([l, h]) => (
                <a key={h} href={h} className="text-[#9a978d] transition-colors hover:text-[#00E676]">{l}</a>
              ))}
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <Link href="/login" className="text-xs uppercase tracking-widest text-[#9a978d] hover:text-[#ece9e0]">Log in</Link>
              <PrimaryBtn href="/register" className="!px-4 !py-2.5 shadow-[4px_4px_0_0_#00E676] hover:shadow-none">Get Access</PrimaryBtn>
            </div>

            <button onClick={() => setMenu(!menu)} className="border-2 border-[#00E676] p-2 text-[#00E676] md:hidden" aria-label="Menu">
              {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {menu && (
            <div className="space-y-1 border-t-2 border-[#222] pb-4 pt-2 md:hidden">
              {[["What's Live", "#live"], ["AI Crew", "#crew"], ["Access", "#access"]].map(([l, h]) => (
                <a key={h} href={h} onClick={() => setMenu(false)} className="block px-1 py-2 text-sm uppercase tracking-widest text-[#9a978d]">{l}</a>
              ))}
              <div className="flex gap-3 pt-2">
                <GhostBtn href="/login" dark className="flex-1 !py-2.5">Log in</GhostBtn>
                <PrimaryBtn href="/register" className="flex-1 !py-2.5 !shadow-none">Get Access</PrimaryBtn>
              </div>
            </div>
          )}
        </div>
      </header>

      <Tape />

      {/* ===== HERO ======================================================= */}
      <section className="relative border-b-2 border-[#222]">
        {/* faint grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "linear-gradient(#00E676 1px, transparent 1px), linear-gradient(90deg, #00E676 1px, transparent 1px)", backgroundSize: "56px 56px" }}
        />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="mb-6 text-xs uppercase tracking-[0.25em] text-[#9a978d]">
              <span className="text-[#00E676]">{"// "}</span>Software for barbershops — EST. 2026
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className={`${DISPLAY} text-[15vw] leading-[0.86] sm:text-7xl lg:text-8xl`}
            >
              Run the<br />
              <span className="text-[#00E676]">chair.</span><br />
              <span className="text-[#4a4a47]">Not the</span><br />
              front desk.
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="mt-8 max-w-xl text-sm leading-relaxed text-[#b9b6ab] sm:text-base">
              SAL is the booking + management system built for barbershops — not soft beauty-app fluff. Fill every chair, run your floor from one screen. And the AI crew that runs your back office? Already on the rails.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <PrimaryBtn href="/register">Get founding access</PrimaryBtn>
              <GhostBtn href="#live" dark>See what’s live</GhostBtn>
            </motion.div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] uppercase tracking-widest text-[#6f6c63]">
              <span><span className="text-[#00E676]">●</span> Status: live</span>
              <span>No credit card</span>
              <span>Beta = free</span>
            </div>
          </div>

          {/* Hero terminal mock */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="lg:col-span-5"
          >
            <div className="border-2 border-[#00E676] bg-[#0e0e0e] shadow-[8px_8px_0_0_#00E676]">
              <div className="flex items-center justify-between border-b-2 border-[#222] px-3 py-2 text-[11px] uppercase tracking-widest text-[#6f6c63]">
                <span>SAL // TODAY</span>
                <span className="text-[#00E676]">● LIVE</span>
              </div>
              <div className="grid grid-cols-3 gap-px bg-[#222]">
                {[["CHAIRS", "06/06"], ["BOOKED", "23"], ["TODAY", "$840"]].map(([k, v]) => (
                  <div key={k} className="bg-[#0e0e0e] px-3 py-3">
                    <div className="text-[10px] uppercase tracking-widest text-[#6f6c63]">{k}</div>
                    <div className={`${DISPLAY} mt-1 text-xl text-[#ece9e0]`}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="divide-y-2 divide-[#1c1c1c]">
                {[
                  ["09:00", "MIKE — Skin fade", "DON"],
                  ["09:45", "TONY — Beard line-up", "RAY"],
                  ["10:30", "WALK-IN — Taper", "DON"],
                  ["11:15", "CARLOS — Fade + beard", "RAY"],
                ].map(([time, name, who]) => (
                  <div key={time} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                    <span className="text-[#6f6c63] w-12 shrink-0">{time}</span>
                    <span className="flex-1 truncate text-[#d8d5ca]">{name}</span>
                    <span className="border border-[#00E676] px-1.5 py-0.5 text-[10px] uppercase text-[#00E676]">{who}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 bg-[#00E676]/10 px-3 py-2.5 text-xs text-[#00E676]">
                  <Plus className="h-3.5 w-3.5" /> 12:00 — open chair · auto-fill from waitlist
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-[#4a4a47]">[ representative — your real board ]</p>
          </motion.div>
        </div>
      </section>

      {/* ===== MANIFESTO BAND ============================================= */}
      <section className="border-b-2 border-[#222] bg-[#0a0a0a] px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="mx-auto max-w-5xl">
          <h2 className={`${DISPLAY} text-3xl leading-[0.95] sm:text-5xl`}>
            Stop running a barbershop out of a <span className="text-[#00E676]">notebook</span> and a <span className="text-[#00E676]">group chat.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-sm text-[#9a978d] sm:text-base">
            Missed texts are missed money. SAL puts the whole shop — the book, the clients, the cash, the numbers — in one place that actually works the way a barbershop works.
          </p>
        </Reveal>
      </section>

      {/* ===== WHAT'S LIVE ================================================ */}
      <section id="live" className="bg-[#ece9e0] text-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-black py-10">
            <h2 className={`${DISPLAY} text-4xl sm:text-6xl`}>What’s<br className="sm:hidden" /> live now</h2>
            <span className="border-2 border-black bg-[#00E676] px-3 py-1 text-xs font-bold uppercase tracking-widest">● Status: shipping</span>
          </Reveal>

          <div className="grid grid-cols-1 gap-px border-x-2 border-b-2 border-black bg-black sm:grid-cols-2 lg:grid-cols-3">
            {liveFeatures.map((f, i) => (
              <Reveal key={f.n} delay={(i % 3) * 0.08} className="h-full">
                <div className="group h-full bg-[#ece9e0] p-7 transition-colors hover:bg-black hover:text-[#ece9e0]">
                  <div className="mb-5 flex items-center justify-between">
                    <span className={`${DISPLAY} text-2xl text-[#00E676]`}>[{f.n}]</span>
                    <span className="text-[10px] uppercase tracking-widest text-[#00E676]">● live</span>
                  </div>
                  <h3 className={`${DISPLAY} text-xl`}>{f.t}</h3>
                  <p className="mt-3 text-xs leading-relaxed text-current opacity-70">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI CREW =================================================== */}
      <section id="crew" className="relative border-b-2 border-[#222] bg-[#0a0a0a]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, #00E676 0 1px, transparent 1px 14px)" }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.25em] text-[#00E676]">{"// "}Status: building — get on the list</p>
            <h2 className={`${DISPLAY} mt-4 text-4xl sm:text-6xl`}>The AI crew<span className="text-[#00E676]">.</span></h2>
            <p className="mt-6 max-w-2xl text-sm text-[#9a978d] sm:text-base">
              The staff a big shop hires that you could never afford — working 24/7, for less than a slow Tuesday. The rails are already built (it’s why SAL is more than a booking app). We don’t ship fake — these go live one at a time, for real. Get in early.
            </p>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-px border-2 border-[#222] bg-[#222] sm:grid-cols-2">
            {crew.map((c, i) => (
              <Reveal key={c.t} delay={(i % 2) * 0.08}>
                <div className="group relative h-full bg-[#0e0e0e] p-7 transition-colors hover:bg-[#101410]">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className={`${DISPLAY} text-2xl`}>{c.t}</h3>
                    <span className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${c.tag === "EARLY ACCESS" ? "border-[#00E676] text-[#00E676]" : "border-[#4a4a47] text-[#6f6c63]"}`}>
                      {c.tag}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-[#9a978d]">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <PrimaryBtn href="/register">Join the early list</PrimaryBtn>
            <span className="text-[11px] uppercase tracking-widest text-[#6f6c63]">Founding shops test the crew first.</span>
          </Reveal>
        </div>
      </section>

      {/* ===== HOW IT WORKS ============================================== */}
      <section className="bg-[#ece9e0] text-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="border-b-2 border-black py-10">
            <h2 className={`${DISPLAY} text-4xl sm:text-6xl`}>Set up<br className="sm:hidden" /> in minutes</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-px border-x-2 border-b-2 border-black bg-black md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1} className="h-full">
                <div className="h-full bg-[#ece9e0] p-7">
                  <span className={`${DISPLAY} text-6xl text-black/15`}>{s.n}</span>
                  <h3 className={`${DISPLAY} mt-3 text-2xl`}>{s.t}</h3>
                  <p className="mt-3 text-xs leading-relaxed text-black/70">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Tape dark />

      {/* ===== BY A BARBER =============================================== */}
      <section className="border-b-2 border-[#222] bg-[#0a0a0a] px-4 py-16 sm:px-6 sm:py-24">
        <Reveal className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <span className="border-2 border-[#00E676] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#00E676]">No tech bros</span>
          </div>
          <div className="lg:col-span-8">
            <h2 className={`${DISPLAY} text-3xl leading-[0.95] sm:text-5xl`}>
              Built by a barber.<br /><span className="text-[#00E676]">Not a spreadsheet.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[#9a978d] sm:text-base">
              SAL is built by someone who actually runs a chair — so it works the way a shop works, not the way software thinks it should. Every screen got the same test: would this make a real barber’s day easier, or just look good in a demo? If it didn’t earn its place, it’s not in here.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ===== ACCESS / PRICING ========================================= */}
      <section id="access" className="bg-[#0a0a0a] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <Reveal className="border-2 border-[#00E676] bg-[#0e0e0e] shadow-[8px_8px_0_0_#00E676]">
            <div className="flex items-center justify-between border-b-2 border-[#222] px-6 py-3 text-[11px] uppercase tracking-widest text-[#6f6c63]">
              <span>SAL // FOUNDING ACCESS</span>
              <span className="text-[#00E676]">● open</span>
            </div>
            <div className="p-7 sm:p-10">
              <h2 className={`${DISPLAY} text-5xl sm:text-7xl`}>Free<span className="text-[#00E676]">.</span></h2>
              <p className="mt-3 text-sm uppercase tracking-widest text-[#9a978d]">During beta — for founding shops</p>
              <p className="mt-4 max-w-md text-sm text-[#b9b6ab]">
                Get in free while we build. No card, no catch. Lock your spot before pricing lands — and get first dibs on the AI crew.
              </p>
              <ul className="my-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {["Unlimited bookings", "Online booking page", "Client list + history", "Staff + schedules", "Cash checkout", "Reports", "First on the AI crew", "Set up in minutes"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[#d8d5ca]">
                    <span className="text-[#00E676]">▸</span> {f}
                  </li>
                ))}
              </ul>
              <PrimaryBtn href="/register" className="w-full">Claim founding access</PrimaryBtn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== BIG CTA ================================================== */}
      <section className="border-y-2 border-black bg-[#00E676] px-4 py-20 text-black sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-5xl text-center">
          <h2 className={`${DISPLAY} text-5xl leading-[0.9] sm:text-8xl`}>Stop losing<br />chairs.</h2>
          <p className="mx-auto mt-6 max-w-md text-sm uppercase tracking-widest">Every empty slot is money walking out the door. Fill them.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="group inline-flex items-center justify-center gap-2 border-2 border-black bg-black px-8 py-4 text-sm font-bold uppercase tracking-widest text-[#00E676] shadow-[5px_5px_0_0_#0a0a0a] transition-all hover:shadow-none hover:translate-x-[5px] hover:translate-y-[5px]">
              Get founding access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center border-2 border-black px-8 py-4 text-sm font-bold uppercase tracking-widest transition-colors hover:bg-black hover:text-[#00E676]">
              Log in
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ===== FOOTER ================================================== */}
      <footer className="bg-[#0a0a0a] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-8 border-b-2 border-[#222] pb-8 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center border-2 border-[#00E676] bg-[#00E676] text-black">
                <Owl className="h-5 w-5" />
              </span>
              <span className={`${DISPLAY} text-2xl`}>SAL</span>
            </Link>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs uppercase tracking-widest text-[#9a978d]">
              <Link href="/terms" className="hover:text-[#00E676]">Terms</Link>
              <Link href="/privacy" className="hover:text-[#00E676]">Privacy</Link>
              <a href="mailto:support@meetsal.ai" className="hover:text-[#00E676]">support@meetsal.ai</a>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-6 text-[11px] uppercase tracking-widest text-[#4a4a47] sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 SAL — meetsal.ai</span>
            <span>Run the chair, not the front desk.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
