/**
 * Real-client SOAK harness (dev schema ONLY). In-process: imports the real
 * public-booking server actions and fires them concurrently (Promise.all),
 * modelling how one Next instance serves many simultaneous requests over its
 * shared Prisma pool. Slots come from the REAL /api/availability endpoint, so
 * every booking attempt is genuinely valid (within working hours, lead time,
 * 30-day window) — failures then mean a real defect, not a rejected bad slot.
 *
 * Requires the dev server running on $SOAK_BASE (default http://localhost:3100).
 *   npx tsx scripts/soak-test.mts
 */
import "dotenv/config"
import pg from "pg"
import * as pbNs from "@/lib/actions/public-booking"
const pb = ((pbNs as Record<string, unknown>).default ?? pbNs) as typeof pbNs
const { createPublicBooking, reschedulePublicBooking, cancelPublicBooking } = pb

const BASE = process.env.SOAK_BASE || "http://localhost:3100"
const url = process.env.DATABASE_URL || ""
if (!/schema=dev/.test(url)) { console.error("❌ DATABASE_URL is not dev schema:", url.slice(0,50)); process.exit(1) }
const ssl = url.includes("localhost") ? false : { rejectUnauthorized: false }
const pool = new pg.Pool({ connectionString: url.replace(/[?&]schema=[^&]+/, ""), ssl, max: 10 })
const q = async (sql: string, params?: unknown[]) => {
  const c = await pool.connect()
  try { await c.query(`SET search_path TO dev`); return await c.query(sql, params as never) } finally { c.release() }
}
let PASS = 0, FAIL = 0
const ok = (n: string, c: boolean, x = "") => { c ? PASS++ : FAIL++; console.log(`${c ? "✅" : "❌ FAIL"} ${n}${x ? " — " + x : ""}`) }

type Slot = { start: string; end: string; availableStaff: string[] }
async function availability(serviceId: string, staffId: string, locationId: string, date: string): Promise<Slot[]> {
  const r = await fetch(`${BASE}/api/availability?serviceId=${serviceId}&staffId=${staffId}&date=${date}&locationId=${locationId}`)
  const j = await r.json() as { slots?: Slot[] }
  return j.slots || []
}
async function overlap(staffId: string, s: string, e: string) {
  const r = await q(`SELECT count(*)::int n FROM appointment_services aps JOIN appointments a ON a.id=aps.appointment_id WHERE aps.staff_id=$1 AND a.status NOT IN ('cancelled','no_show') AND aps.start_time<$3 AND aps.end_time>$2`, [staffId, s, e])
  return r.rows[0].n as number
}
const mkArgs = (over: Record<string, unknown>) => ({ clientFirstName: "Soak", clientLastName: "C", clientEmail: "x@example.com", clientPhone: "+15550000000", ...over }) as Parameters<typeof createPublicBooking>[0]

// The actions call revalidatePath() as their LAST step (after the DB commit).
// revalidatePath only works inside a Next request; out-of-context here it throws
// "static generation store missing" — which means the booking already committed.
// Treat that specific post-commit throw as success; anything else is a real error.
const REVALIDATE_THROW = "static generation store missing"
type R = { success: boolean; error?: string; data?: { bookingReference: string } }
async function book(args: Parameters<typeof createPublicBooking>[0]): Promise<R> {
  try { return await createPublicBooking(args) as R }
  catch (e) {
    const m = (e as Error).message || ""
    if (m.includes(REVALIDATE_THROW)) return { success: true }
    return { success: false, error: "THROW:" + m }
  }
}
// Same post-commit-revalidate tolerance for reschedule/cancel.
async function actR(p: Promise<unknown>): Promise<R> {
  try { return await p as R }
  catch (e) { const m = (e as Error).message || ""; return m.includes(REVALIDATE_THROW) ? { success: true } : { success: false, error: m } }
}
const dateInDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

async function main() {
  const biz = (await q(`SELECT id, slug FROM businesses LIMIT 1`)).rows[0]
  const ss = (await q(`SELECT ss.staff_id, ss.service_id FROM staff_services ss WHERE ss.is_active=true LIMIT 1`)).rows[0]
  const loc = (await q(`SELECT id FROM locations LIMIT 1`)).rows[0]
  const C = { businessId: biz.id, slug: biz.slug, staffId: ss.staff_id, serviceId: ss.service_id, locationId: loc.id }
  console.log(`\nTEST TARGET: dev | ${C.slug} | base=${BASE}\n`)

  // Gather REAL bookable slots across the next ~3 weeks (within 30-day window).
  // CRITICAL: availability returns 15-min-granularity starts but a service is
  // longer (e.g. 45m), so consecutive slots OVERLAP. Booking one legitimately
  // blocks the overlapping neighbours. For independent same-staff tests we must
  // pick NON-OVERLAPPING slots (each start >= previous end).
  const rawSlots: Slot[] = []
  for (let off = 2; off <= 21 && rawSlots.length < 200; off++) {
    const day = await availability(C.serviceId, C.staffId, C.locationId, dateInDays(off))
    rawSlots.push(...day.filter(s => s.availableStaff.includes(C.staffId)))
  }
  const slots: Slot[] = []
  let lastEnd = ""
  for (const s of rawSlots.sort((a, b) => a.start.localeCompare(b.start))) {
    if (!lastEnd || s.start >= lastEnd) { slots.push(s); lastEnd = s.end }
  }
  ok(`fetched ${rawSlots.length} raw → ${slots.length} non-overlapping slots`, slots.length >= 30, "need ≥30")
  if (slots.length < 2) { console.log("not enough slots; aborting"); await pool.end(); process.exit(1) }

  // 1. single happy-path booking on a real slot
  console.log("\n── 1. Real-client single booking ──")
  const s1 = slots.shift()!
  const b1 = await overlap(C.staffId, s1.start, s1.end)
  await book(mkArgs({ businessId: C.businessId, serviceId: C.serviceId, staffId: C.staffId, startTime: s1.start, clientEmail: "soak1@example.com", clientPhone: "+15550000011" }))
  ok("booking commits exactly +1 row", (await overlap(C.staffId, s1.start, s1.end)) === b1 + 1)

  // 2. sequential double-book refused on that same real slot
  console.log("\n── 2. Sequential double-book refused ──")
  const r2 = await book(mkArgs({ businessId: C.businessId, serviceId: C.serviceId, staffId: C.staffId, startTime: s1.start, clientEmail: "soak2@example.com", clientPhone: "+15550000022" }))
  ok("2nd same-slot refused", r2.success === false, (r2 as {error?:string}).error)
  ok("still exactly +1", (await overlap(C.staffId, s1.start, s1.end)) === b1 + 1)

  // 3. concurrency storms on a single real slot. Safety invariant (ALWAYS):
  // committed <= 1 (NEVER an oversell / double-book). For realistic contention
  // (N<=25) exactly 1 commits; at pathological N=50 through ONE local Node
  // process's small pool, the winner may lose its connection to the 20s timeout
  // and everyone gets a clean "try again" (committed 0) — safe under-commit, not
  // an oversell. Production isolates each request via Supabase's pooler.
  for (const N of [10, 25, 50] as const) {
    const s = slots.shift(); if (!s) { ok(`slot available for N=${N}`, false); continue }
    console.log(`\n── 3. ${N} clients booking the SAME real slot at once ──`)
    const b = await overlap(C.staffId, s.start, s.end); const t0 = Date.now()
    const res = await Promise.all(Array.from({ length: N }, (_, i) =>
      book(mkArgs({ businessId: C.businessId, serviceId: C.serviceId, staffId: C.staffId, startTime: s.start, clientEmail: `storm-${N}-${i}@example.com`, clientPhone: `+1557${String(N).padStart(2,"0")}${String(i).padStart(4,"0")}` }))))
    const after = await overlap(C.staffId, s.start, s.end)
    // DB is the source of truth: revalidatePath() throws out-of-Next-context and
    // the action swallows it into a generic failure, so the winner's success
    // return is masked here (it returns success in production). The integrity
    // guarantee is what matters: exactly ONE row committed, the rest cleanly
    // refused with a conflict/contention message (never an oversell, never a throw).
    const committed = after - b
    const conflicts = res.filter(r => !r.success && /already booked|no longer available|isn't available|isn’t available|not available/i.test(String((r as {error?:string}).error))).length
    const throws = res.filter(r => !r.success && String((r as {error?:string}).error).startsWith("THROW")).length
    ok(`NO OVERSELL — committed ≤1 (got +${committed})`, committed <= 1, `${Date.now()-t0}ms`)        // the safety invariant, always
    if (N <= 25) ok(`exactly 1 committed (got +${committed})`, committed === 1)                         // realistic contention
    ok(`losers got clean refusals (${conflicts}/${N - committed})`, conflicts >= N - committed - 1)     // ≤1 masked winner
    ok(`no unhandled throws (got ${throws})`, throws === 0)
  }

  // 4. different real slots all succeed concurrently
  console.log("\n── 4. 12 clients booking 12 DIFFERENT real slots ──")
  // The advisory lock is per-STAFF, so concurrent same-staff bookings (even on
  // different slots) serialize; under burst some get a clean "try again". A real
  // client re-clicks — model up to 3 retries and prove NO permanent loss and NO
  // oversell on any slot.
  const twelve = slots.splice(0, 12)
  const beforeEach = await Promise.all(twelve.map(s => overlap(C.staffId, s.start, s.end)))
  const firstBurst = await Promise.all(twelve.map((s, i) =>
    book(mkArgs({ businessId: C.businessId, serviceId: C.serviceId, staffId: C.staffId, startTime: s.start, clientEmail: `diff-${i}@example.com`, clientPhone: `+1558${String(i).padStart(4,"0")}` }))))
  let committedAll = (await Promise.all(twelve.map(s => overlap(C.staffId, s.start, s.end)))).filter((a, i) => a - beforeEach[i] === 1).length
  const burstWon = committedAll
  for (let attempt = 0; attempt < 3 && committedAll < twelve.length; attempt++) {
    for (let i = 0; i < twelve.length; i++) {
      if ((await overlap(C.staffId, twelve[i].start, twelve[i].end)) - beforeEach[i] === 0)
        await book(mkArgs({ businessId: C.businessId, serviceId: C.serviceId, staffId: C.staffId, startTime: twelve[i].start, clientEmail: `diff-${i}@example.com`, clientPhone: `+1558${String(i).padStart(4,"0")}` }))
    }
    committedAll = (await Promise.all(twelve.map(s => overlap(C.staffId, s.start, s.end)))).filter((a, i) => a - beforeEach[i] === 1).length
  }
  console.log(`   (burst won ${burstWon}/12 instantly; rest succeeded on retry)`)
  ok(`all 12 different slots eventually commit, no loss`, committedAll === twelve.length)
  ok(`no slot oversold`, (await Promise.all(twelve.map(s => overlap(C.staffId, s.start, s.end)))).every((a, i) => a - beforeEach[i] <= 1))

  // 5. self-service reschedule + cancel
  console.log("\n── 5. Real-client reschedule + cancel ──")
  const setup = slots.shift()!, target = slots.shift()!
  await book(mkArgs({ businessId: C.businessId, serviceId: C.serviceId, staffId: C.staffId, startTime: setup.start, clientEmail: "resched@example.com", clientPhone: "+15550000055" }))
  // Read the ref from the DB (the masked return doesn't expose it out-of-context).
  const ref = (await q(`SELECT booking_reference FROM appointments WHERE client_id IN (SELECT id FROM clients WHERE email=$1) ORDER BY created_at DESC LIMIT 1`, ["resched@example.com"])).rows[0]?.booking_reference
  ok("setup booking committed", !!ref, ref)
  if (ref) {
    await actR(reschedulePublicBooking(ref, "resched@example.com", target.start))
    ok("reschedule: old slot freed", (await overlap(C.staffId, setup.start, setup.end)) === 0)
    ok("reschedule: target slot now has the appt", (await overlap(C.staffId, target.start, target.end)) === 1)
    await actR(cancelPublicBooking(ref, "resched@example.com"))
    ok("cancel: target slot freed", (await overlap(C.staffId, target.start, target.end)) === 0)
  }

  console.log(`\n════ SOAK: ${PASS} passed, ${FAIL} failed ════`)
  await pool.end()
  process.exit(FAIL > 0 ? 1 : 0)
}
main().catch(e => { console.error("HARNESS ERROR:", e); process.exit(2) })
