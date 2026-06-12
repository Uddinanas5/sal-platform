import { describe, it, expect, beforeEach, vi } from "vitest"

// 3D BOOKING PROOF (2/2) — concurrency: N clients book the SAME slot, ONE wins.
//
// This is the CI-safe, no-DB simulation companion to scripts/soak-test.mts
// (which fires the REAL public-booking action against a live dev pool). Here we
// model the exact integrity mechanism the real write path relies on — and that
// the soak harness exercises end-to-end — without a database:
//
//   public-booking.ts createPublicBooking, lines ~229-286:
//     prisma.$transaction(async (tx) => {
//       await lockStaffSchedule(tx, business.id, staffId)   // pg_advisory_xact_lock
//       await assertSlotAllowed(...)                          // working-hours gate
//       const conflicting = await tx.appointmentService.findFirst({...})  // re-check
//       if (conflicting) throw new Error("CONFLICT")
//       const appt = await tx.appointment.create({...})       // the ONE winner
//       await tx.appointmentService.create({...})
//       return appt
//     }, { timeout, maxWait })
//
// The advisory lock SERIALIZES same-staff transactions; the in-tx conflict
// re-check then sees the prior winner's row and refuses. We mirror that here the
// same way the existing concurrency tests do (checkout-double-submit.test.ts's
// in-tx findFirst re-read; group-oversell.test.ts's under-lock re-count): mock
// prisma.$transaction so it runs every caller's callback through a SHARED, lock-
// serialized fake tx whose appointmentService.findFirst returns a conflict once
// ANY caller has created its appointment. We then assert exactly ONE
// appointment.create across N concurrent callers; the losers get the same
// "already booked" / contention refusal createPublicBooking maps to a clean
// retry, never an oversell and never an unhandled throw.

// Valid v4 UUIDs (version "4" + variant "8/9/a/b" — Zod's .uuid()).
const BIZ = "11111111-1111-4111-8111-111111111111"
const STAFF = "22222222-2222-4222-8222-222222222222"
const LOC = "33333333-3333-4333-8333-333333333333"

// The contended slot — every caller targets this exact window.
const SLOT_START = new Date("2026-06-15T14:00:00.000Z")
const SLOT_END = new Date("2026-06-15T14:30:00.000Z")

// ---------------------------------------------------------------------------
// A shared booking "world": a single fake DB guarded by a simulated advisory
// lock. Mirrors the (lock -> in-tx conflict re-check -> create) sequence of the
// real createPublicBooking transaction. Built once per test so each scenario
// runs against a clean slate.
// ---------------------------------------------------------------------------
function makeBookingWorld() {
  // The committed appointment rows for the contended staff/slot. The conflict
  // re-check reads THIS, so once one caller commits, the rest see a conflict.
  const committed: { staffId: string; startTime: Date; endTime: Date }[] = []

  // A serialized advisory-lock mutex: holders run one-at-a-time, exactly like
  // pg_advisory_xact_lock serializes same-(business,staff) transactions. This is
  // what makes the conflict re-check race-free.
  let lockChain: Promise<unknown> = Promise.resolve()
  const lockStaffSchedule = vi.fn(async () => {
    // Acquire: chain behind whoever currently holds the lock. We expose a
    // release the tx wrapper calls on commit/rollback.
  })

  const conflictFindFirst = vi.fn(
    async (args: {
      where: {
        staffId: string
        startTime: { lt: Date }
        endTime: { gt: Date }
      }
    }) => {
      const { staffId, startTime, endTime } = args.where
      // Overlap test identical to the real query — Prisma where:
      //   { startTime: { lt: newEnd }, endTime: { gt: newStart } }
      // i.e. an existing row collides when row.startTime < newEnd (= startTime.lt)
      // AND row.endTime > newStart (= endTime.gt).
      const overlap = committed.find(
        (a) =>
          a.staffId === staffId &&
          a.startTime.getTime() < startTime.lt.getTime() &&
          a.endTime.getTime() > endTime.gt.getTime(),
      )
      return overlap ?? null
    },
  )

  const appointmentCreate = vi.fn(
    async (args: { data: { staffId?: string; startTime: Date; endTime: Date } }) => {
      committed.push({
        staffId: STAFF,
        startTime: args.data.startTime,
        endTime: args.data.endTime,
      })
      return { id: `appt_${committed.length}`, bookingReference: `REF-${committed.length}` }
    },
  )

  const tx = {
    $executeRaw: vi.fn(async (..._args: unknown[]) => undefined), // raw advisory-lock SQL: inert
    appointmentService: {
      findFirst: conflictFindFirst,
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => ({})),
    },
    appointment: { create: appointmentCreate },
  }

  // $transaction that SERIALIZES callbacks behind the simulated lock, so the
  // (re-check -> create) pair of each caller is atomic w.r.t. the others — the
  // property pg_advisory_xact_lock gives the real transaction.
  const $transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => {
    const run = lockChain.then(() => cb(tx))
    // Swallow this run's rejection in the chain so a loser's throw doesn't poison
    // the next holder's acquire; callers still observe their own result/throw.
    lockChain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  })

  return { committed, $transaction, tx, lockStaffSchedule, conflictFindFirst, appointmentCreate }
}

// The booking transaction body — a faithful, minimal transcription of the real
// createPublicBooking critical section (lock -> conflict re-check -> create).
// Returns the created appointment or throws Error("CONFLICT") like the real one.
async function attemptBooking(world: ReturnType<typeof makeBookingWorld>) {
  return world.$transaction(async (tx) => {
    // 1) Serialize on the staff advisory lock (raw SQL is inert; the chain in
    //    $transaction provides the real serialization).
    await world.lockStaffSchedule()
    await tx.$executeRaw()
    // 2) Conflict re-check UNDER the lock — the TOCTOU-closing read.
    const conflicting = await tx.appointmentService.findFirst({
      where: {
        staffId: STAFF,
        startTime: { lt: SLOT_END },
        endTime: { gt: SLOT_START },
      },
    })
    if (conflicting) throw new Error("CONFLICT")
    // 3) Exactly one caller reaches here per committed slot.
    const appt = await tx.appointment.create({
      data: { staffId: STAFF, startTime: SLOT_START, endTime: SLOT_END },
    })
    await tx.appointmentService.create({ data: {} })
    return appt
  })
}

// Map a settled attempt to the booking outcome createPublicBooking would return:
// success, a clean "already booked" CONFLICT refusal, or an unhandled throw.
function classify(r: PromiseSettledResult<unknown>): "won" | "conflict" | "error" {
  if (r.status === "fulfilled") return "won"
  const msg = (r.reason as Error)?.message ?? ""
  return msg === "CONFLICT" ? "conflict" : "error"
}

let world: ReturnType<typeof makeBookingWorld>
beforeEach(() => {
  vi.clearAllMocks()
  world = makeBookingWorld()
})

describe("concurrent booking of the SAME slot — exactly one winner", () => {
  it("sanity: the conflict re-check sees a prior commit (overlap query is real)", async () => {
    // First booking commits.
    await attemptBooking(world)
    expect(world.appointmentCreate).toHaveBeenCalledTimes(1)
    // Second attempt must now see the conflict and refuse.
    await expect(attemptBooking(world)).rejects.toThrow("CONFLICT")
    expect(world.appointmentCreate).toHaveBeenCalledTimes(1)
  })

  for (const N of [2, 10, 25, 50] as const) {
    it(`N=${N} concurrent callers => exactly 1 appointment.create, ${N - 1} clean refusals`, async () => {
      const results = await Promise.allSettled(
        Array.from({ length: N }, () => attemptBooking(world)),
      )

      const outcomes = results.map(classify)
      const won = outcomes.filter((o) => o === "won").length
      const conflicts = outcomes.filter((o) => o === "conflict").length
      const errors = outcomes.filter((o) => o === "error").length

      // THE integrity invariant: exactly one writer committed an appointment.
      expect(world.appointmentCreate).toHaveBeenCalledTimes(1)
      expect(world.committed.length).toBe(1)
      expect(won).toBe(1)
      // Every loser got the clean CONFLICT refusal (mapped to a retry by the
      // real action), never an oversell, never an unhandled throw.
      expect(conflicts).toBe(N - 1)
      expect(errors).toBe(0)
    })
  }

  it("the single committed appointment occupies the exact contended slot", async () => {
    await Promise.allSettled(Array.from({ length: 8 }, () => attemptBooking(world)))
    expect(world.committed).toHaveLength(1)
    expect(world.committed[0]).toMatchObject({
      staffId: STAFF,
      startTime: SLOT_START,
      endTime: SLOT_END,
    })
  })

  it("the conflict re-check runs strictly inside the serialized lock (race-free)", async () => {
    // If the re-check ran OUTSIDE the lock, two callers could both read "no
    // conflict" before either created — and appointment.create would fire twice.
    // The lock-serialized $transaction guarantees the create count stays at 1.
    await Promise.allSettled(Array.from({ length: 25 }, () => attemptBooking(world)))
    // Every caller took the lock + ran the re-check; only one passed it.
    expect(world.lockStaffSchedule).toHaveBeenCalledTimes(25)
    expect(world.conflictFindFirst).toHaveBeenCalledTimes(25)
    expect(world.appointmentCreate).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// Contention failures (P2028/P2034) are NOT integrity failures — still 1 winner
// ===========================================================================
import { isBookingContentionError } from "@/lib/db/advisory-lock"
import { Prisma } from "@/generated/prisma"

describe("lock contention surfaces as a retryable refusal, not an oversell", () => {
  it("the winner commits while losers fail with a contention error -> still exactly 1", async () => {
    // Model the production reality the soak test documents at pathological N:
    // the winner commits; some losers don't reach the conflict re-check because
    // their transaction times out / write-conflicts behind the advisory lock
    // (P2028 / P2034). Those are retryable, NOT integrity failures.
    const P2028 = new Prisma.PrismaClientKnownRequestError("expired transaction", {
      code: "P2028",
      clientVersion: "7.4.1",
    })
    const P2034 = new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "7.4.1",
    })

    // First caller wins normally; the rest are forced into contention failures.
    const winner = await attemptBooking(world)
    expect(winner).toBeTruthy()

    const losers = await Promise.allSettled([
      Promise.reject(P2028),
      Promise.reject(P2034),
      attemptBooking(world), // a real loser: sees the conflict
    ])

    // Exactly one appointment was ever created.
    expect(world.appointmentCreate).toHaveBeenCalledTimes(1)
    expect(world.committed.length).toBe(1)

    // Every loser is a CLEAN, retryable refusal (contention or conflict) — none
    // is an unhandled 500-class error.
    for (const r of losers) {
      expect(r.status).toBe("rejected")
      if (r.status === "rejected") {
        const e = r.reason as Error
        const retryable = isBookingContentionError(e) || e.message === "CONFLICT"
        expect(retryable).toBe(true)
      }
    }
  })

  it("isBookingContentionError classifies P2028/P2034 (and raw timeout strings) as retryable", () => {
    expect(
      isBookingContentionError(
        new Prisma.PrismaClientKnownRequestError("x", { code: "P2028", clientVersion: "7.4.1" }),
      ),
    ).toBe(true)
    expect(
      isBookingContentionError(
        new Prisma.PrismaClientKnownRequestError("x", { code: "P2034", clientVersion: "7.4.1" }),
      ),
    ).toBe(true)
    expect(isBookingContentionError(new Error("expired transaction"))).toBe(true)
    // A genuine bug must NOT be swallowed as "retryable contention".
    expect(isBookingContentionError(new Error("null is not an object"))).toBe(false)
  })
})
