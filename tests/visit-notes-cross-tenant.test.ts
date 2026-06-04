import { describe, it, expect, beforeEach, vi } from "vitest"

// Backs the "real cut-notes that persist" workstream (replaces the data-losing
// Notes stub on the client profile). VisitNote now exists, so createVisitNote
// writes a real, authored, timestamped note.
//
// These tests prove, over a mock Prisma + mock auth-utils (no DB):
//   - createVisitNote scopes the write to the caller's businessId (derived from
//     the session, NEVER from input): the client is validated with
//     { id, businessId }, and the created VisitNote carries that same businessId.
//   - a FOREIGN client (one that doesn't exist within the caller's business)
//     is rejected with "Client not found" and NO note is created — a note can
//     never be attached to another tenant's client.
//   - an appointment, if supplied, must also belong to the same business + client.
//   - the author is resolved to the current user's staff profile (scoped to the
//     business via primaryLocation), and authorId is null when none exists.

const { prismaMock, requireMinRoleMock, getBusinessContextMock, revalidatePathMock } =
  vi.hoisted(() => {
    const prismaMock = {
      client: { findFirst: vi.fn() },
      appointment: { findFirst: vi.fn() },
      staff: { findFirst: vi.fn() },
      visitNote: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    }
    return {
      prismaMock,
      requireMinRoleMock: vi.fn(),
      getBusinessContextMock: vi.fn(),
      revalidatePathMock: vi.fn(),
    }
  })

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({
  requireMinRole: requireMinRoleMock,
  getBusinessContext: getBusinessContextMock,
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

import { createVisitNote } from "@/lib/actions/visit-notes"

// Valid v4 UUIDs (version "4" + variant "8/9/a/b" nibbles — Zod's .uuid()).
const BIZ = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const CLIENT = "33333333-3333-4333-8333-333333333333"
const FOREIGN_CLIENT = "44444444-4444-4444-8444-444444444444"
const APPT = "55555555-5555-4555-8555-555555555555"
const STAFF = "66666666-6666-4666-8666-666666666666"
const NOTE = "77777777-7777-4777-8777-777777777777"

beforeEach(() => {
  vi.clearAllMocks()
  requireMinRoleMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "staff" })
  // Default: the client exists within this business, the author has a staff row.
  prismaMock.client.findFirst.mockResolvedValue({ id: CLIENT })
  prismaMock.appointment.findFirst.mockResolvedValue({ id: APPT })
  prismaMock.staff.findFirst.mockResolvedValue({ id: STAFF })
  prismaMock.visitNote.create.mockResolvedValue({ id: NOTE })
})

describe("createVisitNote — tenant isolation", () => {
  it("validates the client against the caller's business and writes the note with that businessId", async () => {
    const result = await createVisitNote({ clientId: CLIENT, body: "#2 fade, beard lined up" })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe(NOTE)

    // The client is looked up scoped to { id, businessId } (tenant isolation).
    expect(prismaMock.client.findFirst).toHaveBeenCalledTimes(1)
    const clientWhere = prismaMock.client.findFirst.mock.calls[0][0].where
    expect(clientWhere).toMatchObject({ id: CLIENT, businessId: BIZ })

    // The created note carries the SESSION businessId, the author's staff id, and
    // the body — never a businessId taken from input.
    expect(prismaMock.visitNote.create).toHaveBeenCalledTimes(1)
    const createData = prismaMock.visitNote.create.mock.calls[0][0].data
    expect(createData.businessId).toBe(BIZ)
    expect(createData.clientId).toBe(CLIENT)
    expect(createData.authorId).toBe(STAFF)
    expect(createData.body).toBe("#2 fade, beard lined up")
  })

  it("rejects a foreign client and writes NOTHING", async () => {
    // The foreign client does not exist *within this business* → findFirst null.
    prismaMock.client.findFirst.mockResolvedValue(null)

    const result = await createVisitNote({ clientId: FOREIGN_CLIENT, body: "leak attempt" })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/client not found/i)

    // The lookup still carried the caller's businessId...
    const clientWhere = prismaMock.client.findFirst.mock.calls[0][0].where
    expect(clientWhere.businessId).toBe(BIZ)
    // ...and no note was created for the foreign client.
    expect(prismaMock.visitNote.create).not.toHaveBeenCalled()
  })

  it("rejects an appointment that does not belong to the business/client", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null)

    const result = await createVisitNote({ clientId: CLIENT, appointmentId: APPT, body: "x" })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/appointment not found/i)
    // The appointment guard is scoped to { id, businessId, clientId }.
    const apptWhere = prismaMock.appointment.findFirst.mock.calls[0][0].where
    expect(apptWhere).toMatchObject({ id: APPT, businessId: BIZ, clientId: CLIENT })
    expect(prismaMock.visitNote.create).not.toHaveBeenCalled()
  })

  it("stores authorId null when the signed-in user has no staff profile", async () => {
    prismaMock.staff.findFirst.mockResolvedValue(null)

    const result = await createVisitNote({ clientId: CLIENT, body: "ownerless note" })

    expect(result.success).toBe(true)
    const createData = prismaMock.visitNote.create.mock.calls[0][0].data
    expect(createData.authorId).toBeNull()
    // The staff lookup itself was scoped to the business via primaryLocation.
    const staffWhere = prismaMock.staff.findFirst.mock.calls[0][0].where
    expect(staffWhere).toMatchObject({ userId: USER, primaryLocation: { businessId: BIZ } })
  })

  it("accepts a photo-only note (no body) and stores the photo URLs", async () => {
    const result = await createVisitNote({
      clientId: CLIENT,
      photoUrls: ["https://img.example.com/cut.jpg"],
    })

    expect(result.success).toBe(true)
    const createData = prismaMock.visitNote.create.mock.calls[0][0].data
    expect(createData.photoUrls).toEqual(["https://img.example.com/cut.jpg"])
    expect(createData.body).toBeNull()
  })

  it("rejects an empty submission (no body and no photos) before any write", async () => {
    const result = await createVisitNote({ clientId: CLIENT })

    expect(result.success).toBe(false)
    expect(prismaMock.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.visitNote.create).not.toHaveBeenCalled()
  })
})
