"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  AnimatePresence,
  type Variants,
} from "framer-motion"
import {
  ArrowRight,
  CalendarDays,
  Globe,
  Users,
  Scissors,
  CreditCard,
  BarChart3,
  Sparkles,
  Bot,
  Megaphone,
  Brain,
  Menu,
  X,
} from "lucide-react"

// ===========================================================================
// SAL — cinematic, animated barbershop OS landing page.
// Deep black + drifting emerald glow, glassy panels, heavy motion. Honest:
// what's LIVE now vs the AI crew (early access / coming).
// ===========================================================================

const G = "#19e08a" // signature emerald

// --- typography helpers -----------------------------------------------------
const HEAD = "font-[family-name:var(--font-sora)] font-bold tracking-tight"
const MONO = "font-[family-name:var(--font-space-mono)]"

// --- reveal on scroll -------------------------------------------------------
function Reveal({ children, className = "", delay = 0, y = 28 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }} className={className}>
      {children}
    </motion.div>
  )
}

// --- word-by-word headline reveal -------------------------------------------
const wordsContainer: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const wordItem: Variants = { hidden: { opacity: 0, y: "0.5em" }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }
function Words({ text, className = "" }: { text: string; className?: string }) {
  return (
    <motion.span variants={wordsContainer} initial="hidden" animate="show" className={className} style={{ display: "inline-block" }}>
      {text.split(" ").map((w, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em" }}>
          <motion.span variants={wordItem} style={{ display: "inline-block" }}>
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}

// --- count-up number --------------------------------------------------------
function CountUp({ to, suffix = "", className = "" }: { to: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    let raf = 0
    const start = performance.now()
    const dur = 1400
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(to * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, to])
  return <span ref={ref} className={className}>{val}{suffix}</span>
}

// --- typewriter (loops) -----------------------------------------------------
function Typewriter({ text, start, onDone }: { text: string; start: boolean; onDone?: () => void }) {
  const [out, setOut] = useState("")
  useEffect(() => {
    if (!start) { setOut(""); return }
    let i = 0
    const id = setInterval(() => {
      i++
      setOut(text.slice(0, i))
      if (i >= text.length) { clearInterval(id); onDone?.() }
    }, 26)
    return () => clearInterval(id)
  }, [start, text, onDone])
  return (
    <span>
      {out}
      {out.length < text.length && <span className="inline-block w-[2px] h-[1em] translate-y-[2px] ml-0.5" style={{ background: G }} />}
    </span>
  )
}

// --- aurora background ------------------------------------------------------
function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-48 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${G}33, transparent 70%)` }}
        animate={{ x: [-120, 120, -120], y: [-20, 40, -20], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-40 -right-40 h-[34rem] w-[34rem] rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${G}22, transparent 70%)` }}
        animate={{ x: [40, -60, 40], y: [0, 60, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  )
}

// --- tilt card --------------------------------------------------------------
function Tilt({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState({ rx: 0, ry: 0 })
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        setT({ rx: -py * 6, ry: px * 6 })
      }}
      onMouseLeave={() => setT({ rx: 0, ry: 0 })}
      style={{ transform: `perspective(900px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)`, transition: "transform 0.2s ease-out" }}
      className={className}
    >
      {children}
    </div>
  )
}

// --- data -------------------------------------------------------------------
const features = [
  { icon: CalendarDays, t: "Booking calendar", d: "Day & week views. Drag to move. Double-booking the same chair is impossible." },
  { icon: Globe, t: "Online booking", d: "Your own link. Clients book 24/7 — it respects your hours, breaks and days off." },
  { icon: Users, t: "Client list", d: "Every client, every visit, every note. See who's loyal and who's slipping." },
  { icon: Scissors, t: "Staff & chairs", d: "Each barber's book, schedule, breaks and time off — locked to their column." },
  { icon: CreditCard, t: "Checkout", d: "Ring up cash sales and keep receipts straight. Card payments coming next." },
  { icon: BarChart3, t: "Reports", d: "Your numbers, no spin. Revenue, retention, no-shows, who actually shows." },
]

const crew = [
  { icon: Sparkles, t: "Ask SAL", d: "Talk to your shop. “Who hasn't been in 2 months?” → it answers, from real data.", tag: "Early access" },
  { icon: Bot, t: "The Front Desk", d: "Books, reschedules and fills last-minute cancellations on its own. 24/7.", tag: "Coming" },
  { icon: Megaphone, t: "The Win-Back", d: "Spots the regular who ghosted you and texts him back. Runs the slow-day offers.", tag: "Coming" },
  { icon: Brain, t: "The Manager", d: "Watches your numbers and tells you straight: raise prices, Saturday's maxed.", tag: "Coming" },
]

const board = [
  ["09:00", "Mike — Skin fade", "Don"],
  ["09:45", "Tony — Beard line-up", "Ray"],
  ["10:30", "Walk-in — Taper", "Don"],
  ["11:15", "Carlos — Fade + beard", "Ray"],
]

// ===========================================================================
export default function LandingPage() {
  const [menu, setMenu] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const panelY = useTransform(scrollYProgress, [0, 1], [0, -60])
  const panelScale = useTransform(scrollYProgress, [0, 1], [1, 0.94])

  // animated booking board: rows appear one by one, then "Ask SAL" typing
  const [rows, setRows] = useState(0)
  const [askDone, setAskDone] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setRows((r) => (r < board.length ? r + 1 : r)), 450)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-[#060708] text-zinc-200 font-[family-name:var(--font-dm-sans)] antialiased overflow-x-hidden selection:bg-[#19e08a] selection:text-black">
      {/* grain */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* ===== NAV ===== */}
      <motion.header initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="sticky top-0 z-50 border-b border-white/5 bg-[#060708]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: G, boxShadow: `0 0 22px ${G}88` }}>
              <Scissors className="h-4 w-4 text-black" />
            </span>
            <span className={`${HEAD} text-xl text-white`}>SAL</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            {[["What's live", "#live"], ["AI crew", "#crew"], ["Access", "#access"]].map(([l, h]) => (
              <a key={h} href={h} className="text-zinc-400 transition-colors hover:text-white">{l}</a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white">Log in</Link>
            <Link href="/register" className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.03]" style={{ background: G, boxShadow: `0 0 24px ${G}66` }}>
              Get access <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <button onClick={() => setMenu(!menu)} className="rounded-lg border border-white/10 p-2 text-white md:hidden" aria-label="Menu">
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        <AnimatePresence>
          {menu && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/5 md:hidden">
              <div className="space-y-1 px-4 py-3">
                {[["What's live", "#live"], ["AI crew", "#crew"], ["Access", "#access"]].map(([l, h]) => (
                  <a key={h} href={h} onClick={() => setMenu(false)} className="block py-2 text-sm text-zinc-300">{l}</a>
                ))}
                <Link href="/register" className="mt-2 block rounded-full py-2.5 text-center text-sm font-semibold text-black" style={{ background: G }}>Get access</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ===== HERO ===== */}
      <section ref={heroRef} className="relative">
        <Aurora />
        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-2 lg:items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
              <span className="flex h-1.5 w-1.5 rounded-full" style={{ background: G, boxShadow: `0 0 8px ${G}` }} />
              The operating system for barbershops
            </motion.div>

            <h1 className={`${HEAD} text-5xl leading-[0.95] text-white sm:text-6xl lg:text-7xl`}>
              <Words text="Run the" />
              <br />
              <span className="relative inline-block">
                <Words text="chair." className="text-transparent bg-clip-text" />
                <motion.span aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="absolute inset-0 bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(120deg, ${G}, #7ef5c0)` }}>
                  chair.
                </motion.span>
              </span>
              <br />
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-zinc-500">
                Not the front desk.
              </motion.span>
            </h1>

            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="mt-7 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
              SAL is the booking + management system built for barbershops — not soft beauty-app fluff. Fill every chair, run your floor from one screen. And the AI crew that runs your back office? Already on the rails.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className="group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]" style={{ background: G, boxShadow: `0 0 34px ${G}55` }}>
                Get founding access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#live" className="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/5">
                See what’s live
              </a>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.15 }} className={`${MONO} mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[11px] uppercase tracking-widest text-zinc-600`}>
              <span><span style={{ color: G }}>●</span> live now</span>
              <span>no credit card</span>
              <span>free during beta</span>
            </motion.div>
          </div>

          {/* animated product panel */}
          <motion.div style={{ y: panelY, scale: panelScale }} className="relative">
            <motion.div initial={{ opacity: 0, y: 40, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }} className="relative rounded-2xl border border-white/10 bg-[#0c0e10]/90 p-1.5 shadow-2xl" style={{ boxShadow: `0 30px 90px -20px ${G}30` }}>
              {/* booking board */}
              <div className="rounded-xl border border-white/5 bg-[#0a0c0d] overflow-hidden">
                <div className={`${MONO} flex items-center justify-between border-b border-white/5 px-4 py-2.5 text-[11px] uppercase tracking-widest text-zinc-500`}>
                  <span>Today</span>
                  <span style={{ color: G }}>● live</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
                  {[["Chairs", 6, "/6"], ["Booked", 23, ""], ["Today", 840, ""]].map(([k, v, s]) => (
                    <div key={k as string} className="px-4 py-3">
                      <div className={`${MONO} text-[10px] uppercase tracking-widest text-zinc-600`}>{k}</div>
                      <div className={`${HEAD} mt-1 text-lg text-white`}>{k === "Today" ? "$" : ""}<CountUp to={v as number} />{s as string}</div>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-white/5">
                  {board.map(([time, name, who], i) => (
                    <AnimatePresence key={time}>
                      {i < rows && (
                        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          <span className={`${MONO} w-12 shrink-0 text-xs text-zinc-600`}>{time}</span>
                          <span className="flex-1 truncate text-zinc-300">{name}</span>
                          <span className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: `${G}55`, color: G }}>{who}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ))}
                  {rows >= board.length && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-4 py-2.5 text-xs" style={{ background: `${G}12`, color: G }}>
                      <Sparkles className="h-3.5 w-3.5" /> 12:00 open — auto-filling from waitlist…
                    </motion.div>
                  )}
                </div>
              </div>

              {/* ask sal mini-chat */}
              <div className="mt-1.5 rounded-xl border border-white/5 bg-[#0a0c0d] p-3">
                <div className={`${MONO} mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-600`}>
                  <Sparkles className="h-3 w-3" style={{ color: G }} /> Ask SAL · early access
                </div>
                <div className="space-y-2">
                  <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-white/10 px-3 py-1.5 text-xs text-zinc-200">Who hasn’t come in 2 months?</div>
                  <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-sm px-3 py-1.5 text-xs text-black" style={{ background: G }}>
                    {rows >= board.length ? <Typewriter text="14 clients. Top 3: Marcus, Dwayne, Leo. Want me to text a win-back offer?" start={rows >= board.length} onDone={() => setAskDone(true)} /> : "…"}
                  </div>
                </div>
              </div>
            </motion.div>
            {askDone && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${MONO} mt-3 text-center text-[10px] uppercase tracking-widest text-zinc-700`}>[ representative — your real shop ]</motion.div>}
          </motion.div>
        </div>
      </section>

      {/* ===== STAT STRIP ===== */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.015]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/5 px-4 sm:px-6 md:grid-cols-4">
          {[["24/7", "online booking"], ["0", "double-bookings"], ["1", "screen for it all"], ["100%", "your data, your shop"]].map(([v, l]) => (
            <Reveal key={l} className="px-2 py-8 text-center">
              <div className={`${HEAD} text-3xl text-white sm:text-4xl`} style={{ textShadow: `0 0 30px ${G}30` }}>{v}</div>
              <div className={`${MONO} mt-1 text-[11px] uppercase tracking-widest text-zinc-500`}>{l}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== WHAT'S LIVE ===== */}
      <section id="live" className="relative z-10 mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <Reveal className="mb-14 max-w-2xl">
          <div className={`${MONO} mb-3 text-xs uppercase tracking-widest`} style={{ color: G }}>{"// what’s live now"}</div>
          <h2 className={`${HEAD} text-4xl text-white sm:text-5xl`}>The whole shop, one screen.</h2>
          <p className="mt-4 text-zinc-400">Real, shipping today. Not a roadmap — these work the day you sign up.</p>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.t} delay={(i % 3) * 0.08}>
              <Tilt className="group h-full rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.04]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all group-hover:scale-110" style={{ color: G }}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className={`${HEAD} text-lg text-white`}>{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.d}</p>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== AI CREW ===== */}
      <section id="crew" className="relative z-10 overflow-hidden border-y border-white/5 bg-[#080a0b]">
        <div className="pointer-events-none absolute inset-0">
          <motion.div className="absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 blur-[120px]" style={{ background: `radial-gradient(circle, ${G}22, transparent 70%)` }} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 8, repeat: Infinity }} />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <Reveal className="mb-14 max-w-2xl">
            <div className={`${MONO} mb-3 text-xs uppercase tracking-widest`} style={{ color: G }}>{"// status: building — get on the list"}</div>
            <h2 className={`${HEAD} text-4xl text-white sm:text-5xl`}>Your AI crew.</h2>
            <p className="mt-4 text-zinc-400">The staff a big shop hires that you could never afford — for less than a slow Tuesday. The rails are built. These switch on one at a time, for real. We don’t ship fake.</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {crew.map((c, i) => (
              <Reveal key={c.t} delay={(i % 2) * 0.08}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5" style={{ color: G }}>
                        <c.icon className="h-5 w-5" />
                      </div>
                      <h3 className={`${HEAD} text-xl text-white`}>{c.t}</h3>
                    </div>
                    <span className={`${MONO} shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-widest ${c.tag === "Early access" ? "" : "border-white/10 text-zinc-500"}`} style={c.tag === "Early access" ? { borderColor: `${G}66`, color: G } : {}}>
                      {c.tag}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link href="/register" className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]" style={{ background: G, boxShadow: `0 0 30px ${G}44` }}>
              Join the early list <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <span className={`${MONO} text-[11px] uppercase tracking-widest text-zinc-600`}>Founding shops test the crew first.</span>
          </Reveal>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <Reveal className="mb-14">
          <div className={`${MONO} mb-3 text-xs uppercase tracking-widest`} style={{ color: G }}>{"// set up in minutes"}</div>
          <h2 className={`${HEAD} text-4xl text-white sm:text-5xl`}>Three steps. You’re live.</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[["01", "Load your shop", "Sign up, add your services, prices and barbers. Minutes, not a manual."], ["02", "Drop your link", "Share your booking link. Clients self-book. Your phone stops blowing up."], ["03", "Run the floor", "Calendar, clients, checkout, numbers — one screen. You stay on the chair."]].map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 0.12}>
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-7">
                <div className={`${HEAD} text-5xl`} style={{ color: `${G}33` }}>{n}</div>
                <h3 className={`${HEAD} mt-3 text-xl text-white`}>{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== BY A BARBER ===== */}
      <section className="relative z-10 border-y border-white/5 bg-[#080a0b] px-4 py-24 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-4xl text-center">
          <div className={`${MONO} mb-4 text-xs uppercase tracking-widest`} style={{ color: G }}>{"// no tech bros"}</div>
          <h2 className={`${HEAD} text-3xl leading-tight text-white sm:text-5xl`}>
            Built by a barber. <span className="text-zinc-500">Not a spreadsheet.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-zinc-400">
            SAL is built by someone who actually runs a chair — so it works the way a shop works, not the way software thinks it should. Every screen got the same test: would this make a real barber’s day easier, or just look good in a demo? If it didn’t earn its place, it’s not in here.
          </p>
        </Reveal>
      </section>

      {/* ===== ACCESS ===== */}
      <section id="access" className="relative z-10 mx-auto max-w-3xl px-4 py-24 sm:px-6 sm:py-32">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-12" style={{ boxShadow: `0 30px 90px -30px ${G}40` }}>
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[90px]" style={{ background: `${G}25` }} />
            <div className="relative">
              <div className={`${MONO} text-xs uppercase tracking-widest`} style={{ color: G }}>{"// founding access — open"}</div>
              <div className="mt-3 flex items-end gap-3">
                <span className={`${HEAD} text-6xl text-white sm:text-7xl`}>Free</span>
                <span className="mb-2 text-sm text-zinc-500">during beta</span>
              </div>
              <p className="mt-4 max-w-md text-zinc-400">Get in free while we build. No card, no catch. Lock your spot before pricing lands — and get first dibs on the AI crew.</p>
              <ul className="my-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {["Unlimited bookings", "Online booking page", "Client list + history", "Staff + schedules", "Cash checkout", "Reports", "First on the AI crew", "Set up in minutes"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: `${G}22`, color: G }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="group inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-4 text-sm font-semibold text-black transition-transform hover:scale-[1.02]" style={{ background: G, boxShadow: `0 0 34px ${G}55` }}>
                Claim founding access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== BIG CTA ===== */}
      <section className="relative z-10 overflow-hidden px-4 py-28 sm:px-6">
        <Aurora />
        <Reveal className="relative mx-auto max-w-4xl text-center">
          <h2 className={`${HEAD} text-5xl leading-[0.95] text-white sm:text-7xl`}>
            Stop losing <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(120deg, ${G}, #8ef7c8)` }}>chairs.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-zinc-400">Every empty slot is money walking out the door. Fill them.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-black transition-transform hover:scale-[1.03]" style={{ background: G, boxShadow: `0 0 40px ${G}66` }}>
              Get founding access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className="inline-flex items-center rounded-full border border-white/15 px-8 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/5">Log in</Link>
          </div>
        </Reveal>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 border-t border-white/5 px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: G }}>
              <Scissors className="h-4 w-4 text-black" />
            </span>
            <span className={`${HEAD} text-lg text-white`}>SAL</span>
          </Link>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <a href="mailto:support@meetsal.ai" className="hover:text-white">support@meetsal.ai</a>
          </div>
          <span className={`${MONO} text-[11px] uppercase tracking-widest text-zinc-700`}>© 2026 SAL · meetsal.ai</span>
        </div>
      </footer>
    </div>
  )
}
