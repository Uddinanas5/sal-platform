"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext, requireMinRole } from "@/lib/auth-utils"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

// A single visit/cut note as surfaced to the client profile UI. Author is the
// staff member who wrote it (resolved to a display name); it is read-only here.
export type VisitNoteView = {
  id: string
  clientId: string
  appointmentId: string | null
  authorId: string | null
  authorName: string | null
  body: string
  photoUrls: string[]
  createdAt: Date
}

const createVisitNoteSchema = z
  .object({
    clientId: z.string().uuid("Invalid client"),
    appointmentId: z.string().uuid("Invalid appointment").optional(),
    // Body is optional ONLY when at least one photo URL is supplied; enforced below.
    body: z.string().trim().max(5000, "Note is too long").optional(),
    photoUrls: z.array(z.string().trim().url("Each photo must be a valid URL")).max(20).optional(),
  })
  .refine((d) => (d.body && d.body.length > 0) || (d.photoUrls && d.photoUrls.length > 0), {
    message: "Add a note or at least one photo",
  })

function mapAuthError(e: unknown): ActionResult<never> | null {
  const msg = (e as Error).message
  if (
    msg === "Not authenticated" ||
    msg === "No business context" ||
    msg.startsWith("Insufficient permissions")
  ) {
    return { success: false, error: msg }
  }
  return null
}

/**
 * Create a timestamped, authored visit/cut note for a client.
 *
 * Tenant isolation (Phase 0 safety): businessId ALWAYS derives from the session
 * (never from caller input). Both the client and (if given) the appointment are
 * re-validated to belong to that business before any write, so a foreign clientId
 * / appointmentId can never have a note attached to it.
 *
 * Author resolution: the note's authorId is the Staff profile of the current
 * session user within this business. If the signed-in user has no staff profile
 * (e.g. an owner without a staff record), authorId is left null — the model
 * allows it — rather than guessing or borrowing another staff id.
 */
export async function createVisitNote(input: {
  clientId: string
  appointmentId?: string
  body?: string
  photoUrls?: string[]
}): Promise<ActionResult<{ id: string }>> {
  let parsed: z.infer<typeof createVisitNoteSchema>
  try {
    parsed = createVisitNoteSchema.parse(input)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    // Any signed-in staff member (or above) may write a cut note.
    const { businessId, userId } = await requireMinRole("staff")

    // Validate the client belongs to THIS business (tenant isolation).
    const client = await prisma.client.findFirst({
      where: { id: parsed.clientId, businessId, deletedAt: null },
      select: { id: true },
    })
    if (!client) {
      return { success: false, error: "Client not found" }
    }

    // If an appointment is referenced, it must also belong to this business and
    // to this same client.
    if (parsed.appointmentId) {
      const appt = await prisma.appointment.findFirst({
        where: { id: parsed.appointmentId, businessId, clientId: parsed.clientId },
        select: { id: true },
      })
      if (!appt) {
        return { success: false, error: "Appointment not found for this client" }
      }
    }

    // Resolve the author = the current user's staff profile in this business.
    // authorId is nullable, so a user without a staff record still gets a note,
    // just without an attributed author.
    const staff = await prisma.staff.findFirst({
      where: { userId, primaryLocation: { businessId } },
      select: { id: true },
    })

    const note = await prisma.visitNote.create({
      data: {
        businessId,
        clientId: parsed.clientId,
        appointmentId: parsed.appointmentId ?? null,
        authorId: staff?.id ?? null,
        body: parsed.body?.trim() || null,
        photoUrls: parsed.photoUrls ?? [],
      },
      select: { id: true },
    })

    revalidatePath(`/clients/${parsed.clientId}`)
    return { success: true, data: { id: note.id } }
  } catch (e) {
    const authErr = mapAuthError(e)
    if (authErr) return authErr
    console.error("createVisitNote error:", e)
    return { success: false, error: (e as Error).message }
  }
}

/**
 * List a client's visit notes, newest first, scoped to the session business.
 * Soft-deleted notes (deletedAt set) are excluded. The client itself is
 * re-validated against the session business so cross-tenant ids return [].
 */
export async function listVisitNotes(clientId: string): Promise<ActionResult<VisitNoteView[]>> {
  try {
    z.string().uuid().parse(clientId)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const notes = await prisma.visitNote.findMany({
      where: { businessId, clientId, deletedAt: null },
      select: {
        id: true,
        clientId: true,
        appointmentId: true,
        authorId: true,
        body: true,
        photoUrls: true,
        createdAt: true,
        author: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const data: VisitNoteView[] = notes.map((n) => ({
      id: n.id,
      clientId: n.clientId,
      appointmentId: n.appointmentId,
      authorId: n.authorId,
      authorName: n.author
        ? `${n.author.user.firstName} ${n.author.user.lastName}`.trim()
        : null,
      body: n.body ?? "",
      photoUrls: n.photoUrls,
      createdAt: n.createdAt,
    }))

    return { success: true, data }
  } catch (e) {
    const authErr = mapAuthError(e)
    if (authErr) return authErr
    console.error("listVisitNotes error:", e)
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Soft-delete a visit note (sets deletedAt). Scoped to the session business so a
 * note in another tenant can never be deleted. A staff member may only delete
 * their OWN note; admins/owners may delete any note in their business.
 */
export async function deleteVisitNote(id: string): Promise<ActionResult> {
  try {
    z.string().uuid().parse(id)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: "Invalid input: " + e.issues[0]?.message }
    }
    throw e
  }

  try {
    const { businessId, userId, role } = await requireMinRole("staff")

    // Load the note within this business only.
    const note = await prisma.visitNote.findFirst({
      where: { id, businessId, deletedAt: null },
      select: { id: true, clientId: true, authorId: true },
    })
    if (!note) {
      return { success: false, error: "Note not found" }
    }

    // Staff may only delete their own note. Resolve the caller's staff id and
    // compare; admins/owners bypass the ownership check.
    const isPrivileged = role === "admin" || role === "owner"
    if (!isPrivileged) {
      const staff = await prisma.staff.findFirst({
        where: { userId, primaryLocation: { businessId } },
        select: { id: true },
      })
      if (!staff || note.authorId !== staff.id) {
        return { success: false, error: "You can only delete your own notes" }
      }
    }

    // Soft-delete, still scoped to the business via the compound where.
    await prisma.visitNote.updateMany({
      where: { id, businessId },
      data: { deletedAt: new Date() },
    })

    revalidatePath(`/clients/${note.clientId}`)
    return { success: true, data: undefined }
  } catch (e) {
    const authErr = mapAuthError(e)
    if (authErr) return authErr
    console.error("deleteVisitNote error:", e)
    return { success: false, error: (e as Error).message }
  }
}
