import { describe, it, expect, beforeEach, vi } from "vitest"

// Proves the one-click CSV client import (`importClients`) over a mock Prisma +
// mock auth-utils (no DB):
//   - dedupe by phone OR email UPDATES an existing match instead of inserting a
//     duplicate; only genuinely-new contacts are created
//   - in-batch dedupe: the same contact twice in one file does not double-insert
//   - businessId is derived from the SESSION and scopes every read AND write —
//     a foreign-tenant client can never be matched or written
//   - fully-blank rows are skipped, invalid emails / nameless rows go to errors[]
//   - the result tallies {created, updated, skipped, errors}

const { prismaMock, getBusinessContextMock, revalidatePathMock } = vi.hoisted(() => {
  const prismaMock = {
    client: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
  return {
    prismaMock,
    getBusinessContextMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth-utils", () => ({ getBusinessContext: getBusinessContextMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))

import { importClients } from "@/lib/actions/clients"

const BIZ = "11111111-1111-4111-8111-111111111111"
const OTHER_BIZ = "99999999-9999-4999-8999-999999999999"
const USER = "22222222-2222-4222-8222-222222222222"

let createCounter = 0

beforeEach(() => {
  vi.clearAllMocks()
  createCounter = 0
  getBusinessContextMock.mockResolvedValue({ userId: USER, businessId: BIZ, role: "admin" })
  // Default: nothing exists -> every row is a fresh insert.
  prismaMock.client.findFirst.mockResolvedValue(null)
  prismaMock.client.create.mockImplementation(async () => ({
    id: `new-${++createCounter}`,
  }))
  prismaMock.client.update.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
  }))
})

describe("importClients — dedupe by phone/email", () => {
  it("inserts new clients and tallies created", async () => {
    const res = await importClients([
      { name: "John Doe", phone: "+1 (555) 111-2222", email: "john@example.com" },
      { name: "Jane Roe", phone: "5553334444", email: "jane@example.com" },
    ])

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.created).toBe(2)
    expect(res.data.updated).toBe(0)
    expect(res.data.skipped).toBe(0)
    expect(prismaMock.client.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })

  it("UPDATES (not inserts) when an existing client matches by email", async () => {
    prismaMock.client.findFirst.mockResolvedValueOnce({ id: "existing-1" })

    const res = await importClients([
      { name: "John D", email: "john@example.com", phone: "+15550000000" },
    ])

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.updated).toBe(1)
    expect(res.data.created).toBe(0)
    expect(prismaMock.client.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.client.create).not.toHaveBeenCalled()

    // The OR match clause includes both email and phone.
    const findArg = prismaMock.client.findFirst.mock.calls[0][0]
    expect(findArg.where.OR).toEqual(
      expect.arrayContaining([{ email: "john@example.com" }, { phone: "+15550000000" }])
    )
    // Update is scoped to the matched id AND the session businessId.
    const updateArg = prismaMock.client.update.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: "existing-1", businessId: BIZ })
  })

  it("UPDATES when an existing client matches by phone only", async () => {
    prismaMock.client.findFirst.mockResolvedValueOnce({ id: "existing-phone" })

    const res = await importClients([{ name: "No Email", phone: "+1 555 777 8888" }])

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.updated).toBe(1)
    expect(res.data.created).toBe(0)
    expect(prismaMock.client.update).toHaveBeenCalledTimes(1)
  })

  it("dedupes WITHIN a single batch (same email twice -> one create, one update)", async () => {
    // No DB match for either row; the second must collapse onto the first.
    const res = await importClients([
      { name: "Dup One", email: "dup@example.com" },
      { name: "Dup Two", email: "DUP@example.com" }, // case-insensitive match
    ])

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.created).toBe(1)
    expect(res.data.updated).toBe(1)
    expect(prismaMock.client.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.client.update).toHaveBeenCalledTimes(1)
    // The second row updated the first row's freshly-created id.
    const updateArg = prismaMock.client.update.mock.calls[0][0]
    expect(updateArg.where.id).toBe("new-1")
    expect(updateArg.where.businessId).toBe(BIZ)
  })

  it("dedupes within a batch by phone (normalized formatting collides)", async () => {
    const res = await importClients([
      { name: "Phone A", phone: "+1 (555) 000-1111" },
      { name: "Phone B", phone: "15550001111" },
    ])

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.created).toBe(1)
    expect(res.data.updated).toBe(1)
  })
})

describe("importClients — businessId scoping (tenant isolation)", () => {
  it("derives businessId from the session, never from input", async () => {
    // Even if a caller smuggles a businessId-shaped field, it is ignored.
    const res = await importClients([
      // @ts-expect-error — extra field is not part of ImportClientRow; must be ignored
      { name: "Trojan", email: "t@example.com", businessId: OTHER_BIZ },
    ])

    expect(res.success).toBe(true)
    // The findFirst (match) read is scoped to the SESSION business.
    const findArg = prismaMock.client.findFirst.mock.calls[0][0]
    expect(findArg.where.businessId).toBe(BIZ)
    // The create write carries the session business, not the smuggled one.
    const createArg = prismaMock.client.create.mock.calls[0][0]
    expect(createArg.data.businessId).toBe(BIZ)
    expect(createArg.data.businessId).not.toBe(OTHER_BIZ)
  })

  it("every match read is scoped by businessId and deletedAt: null", async () => {
    await importClients([{ name: "Scoped", email: "s@example.com", phone: "+15551234567" }])

    const findArg = prismaMock.client.findFirst.mock.calls[0][0]
    expect(findArg.where.businessId).toBe(BIZ)
    expect(findArg.where.deletedAt).toBeNull()
  })

  it("returns the auth error and writes nothing when there is no business context", async () => {
    getBusinessContextMock.mockRejectedValueOnce(new Error("No business context"))

    const res = await importClients([{ name: "X", email: "x@example.com" }])

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error).toBe("No business context")
    expect(prismaMock.client.create).not.toHaveBeenCalled()
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })
})

describe("importClients — validation & row handling", () => {
  it("skips fully-blank rows and records invalid rows as errors", async () => {
    const res = await importClients([
      { name: "Valid Person", email: "valid@example.com" },
      { name: "", email: "", phone: "" }, // fully blank -> skipped
      { name: "Bad Email", email: "not-an-email" }, // invalid -> error
      { firstName: "", lastName: "", phone: "" }, // blank again -> skipped
    ])

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.created).toBe(1)
    expect(res.data.skipped).toBe(2)
    expect(res.data.errors.length).toBe(1)
    expect(res.data.errors[0].message).toMatch(/email/i)
  })

  it("splits a single 'name' into first/last and supports explicit first/last", async () => {
    await importClients([
      { name: "Marie Claire Dubois", email: "marie@example.com" },
      { firstName: "Bob", lastName: "Smith", phone: "+15559990000" },
    ])

    const first = prismaMock.client.create.mock.calls[0][0].data
    expect(first.firstName).toBe("Marie")
    expect(first.lastName).toBe("Claire Dubois")

    const second = prismaMock.client.create.mock.calls[1][0].data
    expect(second.firstName).toBe("Bob")
    expect(second.lastName).toBe("Smith")
  })

  it("does not revalidate when nothing changed (all rows skipped)", async () => {
    const res = await importClients([{ name: "", email: "", phone: "" }])
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.skipped).toBe(1)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
