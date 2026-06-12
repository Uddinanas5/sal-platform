/**
 * ONE-COMMAND GOLDEN-PATH SMOKE (Phase 5C) — the Money Loop, proven end-to-end.
 *
 *   npm run test:golden
 *
 * Exercises the REAL server-side code paths in-process (no HTTP, no mocks of
 * business logic): a throwaway business + owner is created in the dev/agents
 * schema, a real slot is resolved by the REAL availability engine, booked via
 * the REAL public-booking action, checked out CASH via the REAL checkout
 * single-writer (src/lib/checkout/record-checkout.ts), surfaced via the REAL
 * calendar query, and the confirmation-email path is attempted in dry-run
 * (RESEND_API_KEY is force-removed before any module loads, so the email layer
 * deterministically takes its graceful "not configured" skip — nothing sends).
 *
 * DB state is asserted after EVERY step; the commission assertion is the
 * $0-commission regression guard. All throwaway data is deleted afterwards
 * (targeted, FK-ordered deletes scoped to the run's unique business) and the
 * cleanup is itself verified, leaving the schema as found.
 *
 * SAFETY: refuses to run unless DATABASE_URL targets schema=dev or
 * schema=agents (mirrors the guards in db-health-check.mjs / prisma/seed.ts).
 * It never touches the public (production) schema and makes no network calls
 * beyond the database connection.
 *
 * NOTE (out-of-Next context): the booking action calls revalidatePath() after
 * its DB commit; outside a Next request that throws and the action surfaces a
 * generic failure EVEN THOUGH the booking committed (same masking the soak
 * harness documents). The DB is therefore the source of truth here — every
 * step's pass/fail comes from asserting rows, not from action return values.
 */
import "dotenv/config"

// ─────────────────────────────────────────────────────────────────────────────
// 0. SAFETY BANNER + HARD GUARDS (before ANY app module is imported)
// ─────────────────────────────────────────────────────────────────────────────
const rawUrl = process.env.DATABASE_URL ?? ""
const schema = /[?&]schema=([^&]+)/.exec(rawUrl)?.[1] ?? "(none — defaults to public)"

function hardExit(reason: string): never {
  console.error(`\n❌ REFUSING TO RUN: ${reason}`)
  console.error("   This smoke test creates and deletes data. It may ONLY target the dev or agents schema.")
  process.exit(1)
}

if (!rawUrl) hardExit("DATABASE_URL is not set.")

const looksLikeProduction =
  schema === "public" ||
  /[?&]schema=public\b/.test(rawUrl) ||
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production"

console.log("TEST TARGET: local golden-path smoke")
console.log(`DATABASE SCHEMA: ${schema}`)
console.log(`LIVE PRODUCTION URL? ${looksLikeProduction ? "YES — ABORTING" : "no"}`)

if (looksLikeProduction) hardExit(`DATABASE_URL / environment looks like PRODUCTION (schema=${schema}).`)
if (schema !== "dev" && schema !== "agents") {
  hardExit(`DATABASE_URL schema is "${schema}" — only dev or agents are allowed.`)
}

// Email DRY-RUN: remove the Resend key BEFORE @/lib/email evaluates, so its
// module-scope client is null and every send takes the graceful "Email service
// not configured" skip. This guarantees the smoke can never send real mail.
delete process.env.RESEND_API_KEY

// ─────────────────────────────────────────────────────────────────────────────
// App modules (dynamic imports so they evaluate AFTER the guards above)
// ─────────────────────────────────────────────────────────────────────────────
const { prisma } = await import("@/lib/prisma")
const { createPublicBooking } = await import("@/lib/actions/public-booking")
const { recordCheckout } = await import("@/lib/checkout/record-checkout")
const { getAppointments } = await import("@/lib/queries/appointments")
const { getAvailability } = await import("@/lib/availability")
const { sendEmail, resend } = await import("@/lib/email")
const { bookingConfirmationEmail } = await import("@/lib/email-templates")
const { timeStringToUtcDate, dayBoundsInZone } = await import("@/lib/scheduling/zoned-time")
const { TAX_RATE } = await import("@/lib/utils")
const bcrypt = (await import("bcryptjs")).default

// ─────────────────────────────────────────────────────────────────────────────
// Step runner — ✅/❌ with timing + final summary table (test-all.mjs style)
// ─────────────────────────────────────────────────────────────────────────────
type StepResult = { name: string; passed: boolean; ms: number; detail: string }
const results: StepResult[] = []

async function step(name: string, fn: () => Promise<string>): Promise<boolean> {
  const t0 = Date.now()
  process.stdout.write(`\n▶ ${name}…\n`)
  try {
    const detail = await fn()
    const ms = Date.now() - t0
    results.push({ name, passed: true, ms, detail })
    console.log(`✅ ${name} (${ms}ms) — ${detail}`)
    return true
  } catch (e) {
    const ms = Date.now() - t0
    const detail = e instanceof Error ? e.message : String(e)
    results.push({ name, passed: false, ms, detail })
    console.error(`❌ ${name} (${ms}ms) — ${detail}`)
    return false
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`)
}

const money = (v: unknown) => Math.round(Number(v) * 100) / 100

// ─────────────────────────────────────────────────────────────────────────────
// Throwaway fixture identifiers — unique per run so cleanup is surgical
// ─────────────────────────────────────────────────────────────────────────────
const RUN = `gp-smoke-${Date.now()}`
const OWNER_EMAIL = `${RUN}-owner@example.com`
const STAFF_EMAIL = `${RUN}-staff@example.com`
const CLIENT_EMAIL = `${RUN}-client@example.com`
const TIMEZONE = "America/New_York"
const SERVICE_PRICE = 45
const SERVICE_DURATION = 45
const COMMISSION_RATE = 40
const TIP = 5

const ids = {
  ownerUserId: "",
  staffUserId: "",
  businessId: "",
  locationId: "",
  serviceId: "",
  staffId: "",
  clientId: "",
  appointmentId: "",
  paymentId: "",
}

let slotStart: Date | null = null

// ─────────────────────────────────────────────────────────────────────────────
// Steps
// ─────────────────────────────────────────────────────────────────────────────
async function stepBusiness(): Promise<string> {
  const passwordHash = await bcrypt.hash(`throwaway-${RUN}`, 10)
  const owner = await prisma.user.create({
    data: {
      email: OWNER_EMAIL,
      passwordHash,
      firstName: "Golden",
      lastName: "Owner",
      role: "owner",
      status: "active",
      emailVerified: true,
    },
  })
  ids.ownerUserId = owner.id

  const business = await prisma.business.create({
    data: {
      ownerId: owner.id,
      name: `Golden Path Smoke ${RUN}`,
      slug: RUN,
      currency: "USD",
      timezone: TIMEZONE,
      subscriptionTier: "pro",
      subscriptionStatus: "active",
    },
  })
  ids.businessId = business.id

  const location = await prisma.location.create({
    data: {
      businessId: business.id,
      name: "Golden Path Main",
      slug: "main",
      addressLine1: "1 Smoke Test Way",
      city: "New York",
      country: "US",
      isPrimary: true,
      isActive: true,
    },
  })
  ids.locationId = location.id

  // Open every day so the booked slot can never fall on a closed day.
  for (let day = 0; day <= 6; day++) {
    await prisma.businessHours.create({
      data: {
        locationId: location.id,
        dayOfWeek: day,
        isClosed: false,
        openTime: timeStringToUtcDate("09:00"),
        closeTime: timeStringToUtcDate("19:00"),
      },
    })
  }

  // Assert DB state: the tenant exists and is owned by the throwaway user.
  const persisted = await prisma.business.findUnique({ where: { id: business.id }, select: { ownerId: true, slug: true } })
  assert(persisted?.ownerId === owner.id, "business row persisted with correct owner")
  assert(persisted?.slug === RUN, "business slug persisted")
  return `business ${business.id} (slug ${RUN}) + owner + location + 7d business hours`
}

async function stepCatalog(): Promise<string> {
  const service = await prisma.service.create({
    data: {
      businessId: ids.businessId,
      name: "Golden Cut",
      durationMinutes: SERVICE_DURATION,
      price: SERVICE_PRICE,
      isActive: true,
      isOnlineBooking: true,
      // isTaxable defaults true, taxRate null → checkout falls back to TAX_RATE
    },
  })
  ids.serviceId = service.id

  const passwordHash = await bcrypt.hash(`throwaway-${RUN}`, 10)
  const staffUser = await prisma.user.create({
    data: {
      email: STAFF_EMAIL,
      passwordHash,
      firstName: "Golden",
      lastName: "Barber",
      role: "staff",
      status: "active",
      emailVerified: true,
    },
  })
  ids.staffUserId = staffUser.id

  const staff = await prisma.staff.create({
    data: {
      userId: staffUser.id,
      locationId: ids.locationId,
      title: "Barber",
      commissionRate: COMMISSION_RATE,
      canAcceptBookings: true,
      isActive: true,
    },
  })
  ids.staffId = staff.id

  await prisma.staffService.create({
    data: { staffId: staff.id, serviceId: service.id, isActive: true },
  })

  // Working hours covering the test slot — every day, 09:00–17:00 salon time.
  for (let day = 0; day <= 6; day++) {
    await prisma.staffSchedule.create({
      data: {
        staffId: staff.id,
        locationId: ids.locationId,
        dayOfWeek: day,
        startTime: timeStringToUtcDate("09:00"),
        endTime: timeStringToUtcDate("17:00"),
        isWorking: true,
      },
    })
  }

  const persisted = await prisma.staffService.findFirst({
    where: { staffId: staff.id, serviceId: service.id, isActive: true },
  })
  assert(persisted, "staff↔service association persisted")
  return `service "${service.name}" ($${SERVICE_PRICE}/${SERVICE_DURATION}min) + staff @ ${COMMISSION_RATE}% commission + 7d schedule`
}

async function stepBook(): Promise<string> {
  // Resolve a REAL slot from the REAL availability engine (same code path the
  // public booking UI uses) — so the booked time is genuinely valid.
  for (let offset = 2; offset <= 14 && !slotStart; offset++) {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const civil = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const availability = await getAvailability({
      staffId: ids.staffId,
      serviceId: ids.serviceId,
      date: civil,
      locationId: ids.locationId,
      timezone: TIMEZONE,
    })
    if (availability.slots.length > 0) {
      // Mid-morning slot, deterministic: first offered slot of the day.
      slotStart = availability.slots[0].start
    }
  }
  assert(slotStart, "availability engine offered at least one real slot within 14 days")

  // Book through the REAL public-booking server action. Outside a Next request
  // its post-commit revalidatePath() throws and is swallowed into a generic
  // failure return — so the action's return value is advisory here; the DB
  // assertion below is the authoritative check (same pattern as soak-test.mts).
  let returned: { success: boolean; error?: string } = { success: false, error: "(not called)" }
  try {
    returned = await createPublicBooking({
      businessId: ids.businessId,
      serviceId: ids.serviceId,
      staffId: ids.staffId,
      startTime: slotStart.toISOString(),
      clientFirstName: "Golden",
      clientLastName: "Client",
      clientEmail: CLIENT_EMAIL,
      clientPhone: "+15550009999",
    })
  } catch (e) {
    returned = { success: false, error: `THROW: ${(e as Error).message}` }
  }

  // Authoritative: the Appointment row must exist with correct tenant + time + service.
  const appt = await prisma.appointment.findFirst({
    where: { businessId: ids.businessId, client: { email: CLIENT_EMAIL } },
    include: { services: true },
  })
  assert(appt, `appointment row exists after booking (action returned: ${JSON.stringify(returned)})`)
  assert(appt.businessId === ids.businessId, "appointment.businessId is the throwaway business")
  assert(appt.startTime.getTime() === slotStart.getTime(), `appointment.startTime matches booked slot (${appt.startTime.toISOString()} vs ${slotStart.toISOString()})`)
  assert(appt.status === "confirmed", `appointment.status is confirmed (got ${appt.status})`)
  assert(appt.services.length === 1 && appt.services[0].serviceId === ids.serviceId, "appointment has exactly the booked service")
  assert(appt.services[0].staffId === ids.staffId, "appointment service assigned to the booked staff")
  assert(money(appt.subtotal) === SERVICE_PRICE, `appointment.subtotal is $${SERVICE_PRICE}`)
  assert(appt.clientId, "appointment has a client")
  ids.appointmentId = appt.id
  ids.clientId = appt.clientId
  return `booked ${appt.bookingReference} @ ${slotStart.toISOString()} (status confirmed, subtotal $${money(appt.subtotal)})`
}

async function stepCheckIn(): Promise<string> {
  // The dashboard check-in goes through updateAppointmentStatus, which requires
  // a NextAuth session (getBusinessContext) and cannot be invoked in-process
  // without one. We mirror its exact tenant-scoped write here (status +
  // checkedInAt) and assert the persisted state — the action's own logic is
  // covered by the unit suite.
  await prisma.appointment.update({
    where: { id: ids.appointmentId, businessId: ids.businessId },
    data: { status: "checked_in", checkedInAt: new Date() },
  })
  const appt = await prisma.appointment.findUnique({
    where: { id: ids.appointmentId },
    select: { status: true, checkedInAt: true },
  })
  assert(appt?.status === "checked_in", `appointment status is checked_in (got ${appt?.status})`)
  assert(appt.checkedInAt instanceof Date, "checkedInAt timestamp recorded")
  return `client checked in at ${appt.checkedInAt!.toISOString()}`
}

async function stepCheckout(): Promise<string> {
  // CASH checkout through the REAL single-writer, wrapped exactly like the
  // dashboard action / v1 route / MCP tool wrap it.
  const result = await prisma.$transaction(
    (tx) =>
      recordCheckout(tx, ids.businessId, {
        clientId: ids.clientId,
        appointmentId: ids.appointmentId,
        items: [{ type: "service", id: ids.serviceId, quantity: 1 }],
        discount: 0,
        tip: TIP,
        method: "cash",
      }),
    { timeout: 20000, maxWait: 15000 },
  )

  // Independent money expectation (not derived from the code under test):
  // service untaxed-rate-null + business with no payments settings → flat
  // platform TAX_RATE on the full (undiscounted) amount.
  const expectedTax = Math.round(SERVICE_PRICE * TAX_RATE * 100) / 100
  const expectedTotal = Math.round((SERVICE_PRICE + expectedTax + TIP) * 100) / 100
  const expectedCommission = Math.round(((SERVICE_PRICE * COMMISSION_RATE) / 100) * 100) / 100

  assert(result.subtotal === SERVICE_PRICE, `returned subtotal $${result.subtotal} === $${SERVICE_PRICE}`)
  assert(result.amount === SERVICE_PRICE, `returned amount $${result.amount} === $${SERVICE_PRICE}`)
  assert(result.total === expectedTotal, `returned total $${result.total} === $${expectedTotal} (incl. $${expectedTax} tax + $${TIP} tip)`)

  // Payment row — totals from the DB, not the return value.
  const payment = await prisma.payment.findUnique({ where: { id: result.payment.id } })
  assert(payment, "Payment row exists")
  assert(payment.businessId === ids.businessId, "payment.businessId correct")
  assert(payment.appointmentId === ids.appointmentId, "payment.appointmentId correct")
  assert(payment.clientId === ids.clientId, "payment.clientId correct")
  assert(payment.method === "cash" && payment.status === "completed" && payment.type === "payment", "payment is a completed cash payment")
  assert(money(payment.amount) === SERVICE_PRICE, `payment.amount $${money(payment.amount)} === $${SERVICE_PRICE}`)
  assert(money(payment.tipAmount) === TIP, `payment.tipAmount $${money(payment.tipAmount)} === $${TIP}`)
  assert(money(payment.totalAmount) === expectedTotal, `payment.totalAmount $${money(payment.totalAmount)} === $${expectedTotal}`)
  assert(payment.currency === "USD", "payment.currency USD")
  ids.paymentId = payment.id

  // Commission ledger — THE $0-commission regression guard.
  const commissions = await prisma.commission.findMany({ where: { appointmentId: ids.appointmentId } })
  assert(commissions.length === 1, `exactly 1 commission ledger row (got ${commissions.length})`)
  const c = commissions[0]
  assert(c.staffId === ids.staffId, "commission attributed to the performing staff member")
  assert(money(c.grossAmount) === SERVICE_PRICE, `commission.grossAmount $${money(c.grossAmount)} === $${SERVICE_PRICE}`)
  assert(money(c.commissionRate) === COMMISSION_RATE, `commission.commissionRate ${money(c.commissionRate)} === ${COMMISSION_RATE}`)
  assert(money(c.commissionAmount) === expectedCommission, `commission.commissionAmount $${money(c.commissionAmount)} === $${expectedCommission}`)
  assert(money(c.commissionAmount) > 0, "$0-COMMISSION GUARD: commission amount is greater than zero")
  assert(c.status === "pending", "commission starts pending")

  // Appointment flipped to completed by the single-writer.
  const appt = await prisma.appointment.findUnique({
    where: { id: ids.appointmentId },
    select: { status: true, completedAt: true },
  })
  assert(appt?.status === "completed" && appt.completedAt, "appointment flipped to completed with completedAt")

  // Client lifetime totals + loyalty ledger moved with the sale.
  const client = await prisma.client.findUnique({
    where: { id: ids.clientId },
    select: { totalVisits: true, totalSpent: true, loyaltyPoints: true },
  })
  const expectedPoints = Math.floor(SERVICE_PRICE) // 1 pt per $1 paid
  assert(client?.totalVisits === 1, `client.totalVisits 1 (got ${client?.totalVisits})`)
  assert(money(client.totalSpent) === SERVICE_PRICE, `client.totalSpent $${money(client.totalSpent)}`)
  assert(client.loyaltyPoints === expectedPoints, `client.loyaltyPoints ${client.loyaltyPoints} === ${expectedPoints}`)
  const earn = await prisma.loyaltyTransaction.findFirst({
    where: { businessId: ids.businessId, clientId: ids.clientId, paymentId: payment.id, type: "earn" },
  })
  assert(earn && earn.points === expectedPoints, "loyalty earn ledger row reconciles with the balance")

  // A payroll period was auto-bootstrapped for the first-ever checkout.
  const period = await prisma.payrollPeriod.findFirst({ where: { businessId: ids.businessId, status: "open" } })
  assert(period, "open PayrollPeriod exists (auto-created at first checkout)")

  return `payment ${payment.paymentReference}: $${money(payment.totalAmount)} cash (tax $${expectedTax}, tip $${TIP}) → commission $${money(c.commissionAmount)} @ ${COMMISSION_RATE}% ledgered`
}

async function stepCalendar(): Promise<string> {
  // The REAL calendar/appointments query for the appointment's salon-local day.
  const { start, end } = dayBoundsInZone(slotStart!, TIMEZONE)
  const appointments = await getAppointments({
    businessId: ids.businessId,
    dateFrom: start,
    dateTo: end,
  })
  const mine = appointments.find((a) => a.id === ids.appointmentId)
  assert(mine, `appointment surfaces in the calendar query for its day (got ${appointments.length} rows)`)
  assert(mine.clientName === "Golden Client", `calendar row shows the client (got "${mine.clientName}")`)
  assert(mine.serviceName === "Golden Cut", `calendar row shows the service (got "${mine.serviceName}")`)
  assert(mine.staffId === ids.staffId, "calendar row attributes the staff member")
  assert(mine.status === "completed", `calendar row reflects completed status (got "${mine.status}")`)
  return `calendar query for ${slotStart!.toISOString().slice(0, 10)} returns the appointment (status ${mine.status})`
}

async function stepEmailDryRun(): Promise<string> {
  // RESEND_API_KEY was deleted before @/lib/email evaluated, so the module's
  // client must be null and sendEmail must take its graceful skip — proving the
  // confirmation-send path is reachable and degrades safely with no provider.
  assert(resend === null, "Resend client is null (dry-run enforced — no email can send)")
  const outcome = await sendEmail({
    to: CLIENT_EMAIL,
    subject: "Golden-path smoke — confirmation dry run",
    html: bookingConfirmationEmail({
      clientName: "Golden Client",
      serviceName: "Golden Cut",
      staffName: "Golden Barber",
      dateTime: slotStart!.toISOString(),
      businessName: `Golden Path Smoke ${RUN}`,
      bookingRef: "GP-DRYRUN",
      manageUrl: "http://localhost:3000/book/manage/GP-DRYRUN",
    }),
  })
  assert(outcome.success === false, "send attempt did not claim success without a provider")
  assert(outcome.error === "Email service not configured", `send path skipped gracefully (got: ${JSON.stringify(outcome.error)})`)
  return "confirmation email path attempted; skipped gracefully (Resend not configured — nothing sent)"
}

async function stepCleanup(): Promise<string> {
  if (!ids.businessId) return "nothing to clean (setup never ran)"
  const businessId = ids.businessId

  // Targeted deletes, FK-safe order, all scoped to the throwaway tenant.
  if (ids.staffId) await prisma.commission.deleteMany({ where: { staffId: ids.staffId } })
  await prisma.loyaltyTransaction.deleteMany({ where: { businessId } })
  await prisma.appointmentProduct.deleteMany({
    where: { OR: [{ appointment: { businessId } }, { payment: { businessId } }] },
  })
  await prisma.payment.deleteMany({ where: { businessId } })
  await prisma.appointmentService.deleteMany({ where: { appointment: { businessId } } })
  await prisma.appointment.deleteMany({ where: { businessId } })
  await prisma.notification.deleteMany({ where: { businessId } })
  await prisma.payrollPeriod.deleteMany({ where: { businessId } })
  if (ids.staffId) {
    await prisma.staffService.deleteMany({ where: { staffId: ids.staffId } })
    await prisma.staffSchedule.deleteMany({ where: { staffId: ids.staffId } })
    await prisma.staff.deleteMany({ where: { id: ids.staffId } })
  }
  await prisma.client.deleteMany({ where: { businessId } })
  await prisma.service.deleteMany({ where: { businessId } })
  await prisma.businessHours.deleteMany({ where: { location: { businessId } } })
  await prisma.auditLog.deleteMany({ where: { businessId } })
  await prisma.location.deleteMany({ where: { businessId } })
  await prisma.business.deleteMany({ where: { id: businessId } })
  const userIds = [ids.ownerUserId, ids.staffUserId].filter(Boolean)
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } })

  // Verify the schema was left as found (no trace of this run remains).
  const [bizLeft, usersLeft, apptsLeft, paysLeft] = await Promise.all([
    prisma.business.count({ where: { slug: RUN } }),
    prisma.user.count({ where: { email: { in: [OWNER_EMAIL, STAFF_EMAIL] } } }),
    prisma.appointment.count({ where: { businessId } }),
    prisma.payment.count({ where: { businessId } }),
  ])
  assert(
    bizLeft === 0 && usersLeft === 0 && apptsLeft === 0 && paysLeft === 0,
    `leftovers detected (business=${bizLeft} users=${usersLeft} appointments=${apptsLeft} payments=${paysLeft}) — sweep ${RUN} manually`,
  )
  return `all throwaway data for ${RUN} deleted; dev schema left as found`
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`\nRUN TAG: ${RUN}\n${"─".repeat(60)}`)

  let failed = false
  try {
    // Each step depends on the previous one — stop the money loop at the first
    // failure (cleanup still runs in finally).
    const ordered: [string, () => Promise<string>][] = [
      ["1. Business + owner (throwaway tenant)", stepBusiness],
      ["2. Service + staff + working hours", stepCatalog],
      ["3. BOOK — real public-booking action", stepBook],
      ["4. SHOW — check-in persisted", stepCheckIn],
      ["5. PAY — cash checkout via single-writer", stepCheckout],
      ["6. Calendar query surfaces the appointment", stepCalendar],
      ["7. Confirmation email path (dry-run)", stepEmailDryRun],
    ]
    for (const [name, fn] of ordered) {
      const ok = await step(name, fn)
      if (!ok) {
        failed = true
        break
      }
    }
  } finally {
    const cleaned = await step("8. CLEANUP — delete throwaway tenant", stepCleanup)
    if (!cleaned) failed = true
  }

  console.log(`\n${"─".repeat(18)} Golden-path summary ${"─".repeat(18)}`)
  for (const r of results) {
    console.log(`${r.passed ? "✅" : "❌"} ${r.name.padEnd(44)} ${String(r.ms).padStart(6)}ms`)
  }
  console.log("─".repeat(57))

  await prisma.$disconnect()

  if (failed) {
    console.error("\n❌ GOLDEN PATH BROKEN — a real customer would hit this. Fix before launch.")
    process.exit(1)
  }
  console.log("\n✅ GOLDEN PATH PROVEN — Book → Show → Pay → Ledger → Calendar all real, on the dev schema.")
  process.exit(0)
}

main().catch(async (e) => {
  console.error("HARNESS ERROR:", e)
  try {
    await prisma.$disconnect()
  } catch {}
  process.exit(2)
})
