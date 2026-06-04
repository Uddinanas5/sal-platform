"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const createClientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  allergies: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

const updateClientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").optional(),
  lastName: z.string().trim().min(1, "Last name is required").optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  allergies: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function createClient(data: {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  notes?: string
  allergies?: string
  tags?: string[]
}): Promise<ActionResult<{ id: string }>> {
  try {
    createClientSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const normalizedEmail = data.email?.trim().toLowerCase() || null

    if (normalizedEmail) {
      const existing = await prisma.client.findFirst({
        where: { businessId, email: normalizedEmail },
      })
      if (existing) return { success: false, error: "A client with this email already exists" }
    }

    const client = await prisma.client.create({
      data: {
        businessId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: normalizedEmail,
        phone: data.phone || null,
        notes: data.notes || null,
        allergies: data.allergies?.trim() || null,
        tags: data.tags || [],
      },
    })

    revalidatePath("/clients")
    revalidatePath("/dashboard")
    return { success: true, data: { id: client.id } }
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("createClient error:", e)
    return { success: false, error: msg }
  }
}

export async function updateClient(
  id: string,
  data: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    notes?: string
    allergies?: string
    tags?: string[]
  }
): Promise<ActionResult> {
  try {
    z.string().uuid().parse(id)
    updateClientSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    if (data.email) {
      const normalizedEmail = data.email.trim().toLowerCase()
      const existing = await prisma.client.findFirst({
        where: { businessId, email: normalizedEmail, id: { not: id } },
      })
      if (existing) return { success: false, error: "A client with this email already exists" }
      data.email = normalizedEmail
    }

    await prisma.client.update({
      where: { id, businessId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        allergies: data.allergies !== undefined ? (data.allergies.trim() || null) : undefined,
        tags: data.tags,
      },
    })

    revalidatePath("/clients")
    revalidatePath(`/clients/${id}`)
    return { success: true, data: undefined }
  } catch (e) {
    console.error("updateClient error:", e)
    return { success: false, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Bulk client import (one-click CSV import)
// ---------------------------------------------------------------------------
//
// Accepts an array of loosely-shaped parsed rows. For each non-blank row we
// build a clean { firstName, lastName, email?, phone?, notes? } payload, then
// UPSERT into the Client table scoped to the SESSION businessId (never input):
//   - match an existing client by normalized email OR normalized phone within
//     the same business -> update it (fill in missing fields, never null-out)
//   - otherwise insert a new client
// Fully-blank rows are skipped. Per-row validation failures are collected into
// `errors[]` (with a 1-based row number) and do not abort the whole import.

export type ImportClientRow = {
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  notes?: string
}

export type ImportClientsResult = {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

// Split a single "Full Name" into first / last. Everything after the first
// whitespace-delimited token becomes the last name.
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  const firstName = parts[0]
  const lastName = parts.slice(1).join(" ")
  return { firstName, lastName }
}

function normalizeEmail(raw?: string): string | null {
  const v = raw?.trim().toLowerCase()
  return v ? v : null
}

// Normalize a phone number for dedupe matching: digits only (the leading "+" is
// dropped so "+1 (555) 000-1111" and "15550001111" collide as the same number).
// We store the original (trimmed) phone but match dedupe on this canonical form.
function normalizePhone(raw?: string): string | null {
  const v = raw?.trim()
  if (!v) return null
  const digits = v.replace(/\D/g, "")
  if (!digits) return null
  return digits
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function importClients(
  rows: ImportClientRow[]
): Promise<ActionResult<ImportClientsResult>> {
  if (!Array.isArray(rows)) {
    return { success: false, error: "Invalid input: expected an array of rows" }
  }

  let businessId: string
  try {
    // businessId ALWAYS derives from the session — never from caller input.
    const ctx = await getBusinessContext()
    businessId = ctx.businessId
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("importClients context error:", e)
    return { success: false, error: msg }
  }

  const result: ImportClientsResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  // Track keys already processed in THIS batch so two rows with the same email
  // or phone don't both insert (the second updates the first's new row).
  const seenEmail = new Map<string, string>() // normalized email -> client id
  const seenPhone = new Map<string, string>() // normalized phone -> client id

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1
    const raw = rows[i] || {}

    // Derive name from explicit first/last, falling back to a single "name".
    let firstName = (raw.firstName ?? "").trim()
    let lastName = (raw.lastName ?? "").trim()
    if (!firstName && !lastName && raw.name) {
      const split = splitName(raw.name)
      firstName = split.firstName
      lastName = split.lastName
    }

    const email = normalizeEmail(raw.email)
    const phone = (raw.phone ?? "").trim() || null
    const phoneKey = normalizePhone(raw.phone)
    const notes = (raw.notes ?? "").trim() || null

    // Skip fully-blank rows (no name, email, or phone at all).
    if (!firstName && !lastName && !email && !phoneKey) {
      result.skipped++
      continue
    }

    // A client needs at least a name OR a contact handle to be useful.
    if (!firstName && !lastName) {
      result.errors.push({ row: rowNum, message: "Missing name" })
      continue
    }

    if (email && !EMAIL_RE.test(email)) {
      result.errors.push({ row: rowNum, message: `Invalid email "${email}"` })
      continue
    }

    // createClient requires a last name; default an empty one so single-name
    // imports (e.g. "Cher") still succeed.
    if (!firstName) {
      firstName = lastName
      lastName = ""
    }

    try {
      // 1) Match within this batch first (avoids duplicate inserts when the same
      //    contact appears twice in one file).
      let matchId: string | null = null
      if (email && seenEmail.has(email)) matchId = seenEmail.get(email)!
      else if (phoneKey && seenPhone.has(phoneKey)) matchId = seenPhone.get(phoneKey)!

      // 2) Otherwise match an existing client in this business by email OR phone.
      if (!matchId) {
        const orClauses: Array<{ email?: string; phone?: string }> = []
        if (email) orClauses.push({ email })
        if (phone) orClauses.push({ phone })
        if (orClauses.length > 0) {
          const existing = await prisma.client.findFirst({
            where: { businessId, deletedAt: null, OR: orClauses },
            select: { id: true },
          })
          if (existing) matchId = existing.id
        }
      }

      if (matchId) {
        // Update an existing client. Only fill fields we actually have so an
        // import never blanks out previously-captured data.
        await prisma.client.update({
          where: { id: matchId, businessId },
          data: {
            firstName: firstName || undefined,
            lastName: lastName !== "" ? lastName : undefined,
            email: email ?? undefined,
            phone: phone ?? undefined,
            notes: notes ?? undefined,
          },
        })
        result.updated++
        if (email) seenEmail.set(email, matchId)
        if (phoneKey) seenPhone.set(phoneKey, matchId)
      } else {
        const created = await prisma.client.create({
          data: {
            businessId,
            firstName,
            lastName,
            email: email ?? null,
            phone: phone ?? null,
            notes: notes ?? null,
            tags: [],
          },
          select: { id: true },
        })
        result.created++
        if (email) seenEmail.set(email, created.id)
        if (phoneKey) seenPhone.set(phoneKey, created.id)
      }
    } catch (e) {
      result.errors.push({ row: rowNum, message: (e as Error).message })
    }
  }

  if (result.created > 0 || result.updated > 0) {
    revalidatePath("/clients")
    revalidatePath("/dashboard")
  }

  return { success: true, data: result }
}

export async function deleteClient(id: string): Promise<ActionResult> {
  try {
    const { businessId } = await getBusinessContext()

    await prisma.client.update({
      where: { id, businessId },
      data: { deletedAt: new Date() },
    })

    revalidatePath("/clients")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("deleteClient error:", e)
    return { success: false, error: (e as Error).message }
  }
}
