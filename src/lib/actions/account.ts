"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"
import { sendEmail } from "@/lib/email"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

const requestAccountDeletionSchema = z.object({
  // The owner must re-type the exact business name to confirm. We compare the
  // typed value against the persisted Business.name (case-sensitive, trimmed).
  confirmName: z.string().min(1, "Type your business name to confirm"),
})

/**
 * Honest account deletion request (beta).
 *
 * This does NOT hard-delete a business that has bookings/payments. Instead it:
 *   1. Marks the subscription cancelled (subscriptionStatus = "cancelled").
 *   2. Writes an AuditLog row recording who requested deletion and when.
 *   3. Emails support@meetsal.ai with the deletion request so the team can
 *      process the actual data removal within 30 days (see /privacy §5).
 *
 * Owner-only: staff/admins cannot delete the business. The caller must re-type
 * the exact business name as a guardrail against accidental deletion.
 *
 * The client component is responsible for signing the user out after a success
 * result (via next-auth/react signOut), since a "use server" action cannot
 * reliably clear the browser session and return a result at the same time.
 */
export async function requestAccountDeletion(data: {
  confirmName: string
}): Promise<ActionResult> {
  let parsed: z.infer<typeof requestAccountDeletionSchema>
  try {
    parsed = requestAccountDeletionSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    }
    throw e
  }

  let userId: string
  let businessId: string
  let role: string
  try {
    const ctx = await getBusinessContext()
    userId = ctx.userId
    businessId = ctx.businessId
    role = ctx.role
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Not authenticated" || msg === "No business context") {
      return { success: false, error: msg }
    }
    console.error("requestAccountDeletion context error:", e)
    return { success: false, error: msg }
  }

  // Owner-only. Even admins cannot tear down the business.
  if (role !== "owner") {
    return { success: false, error: "Only the business owner can delete the account" }
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, email: true, subscriptionStatus: true, ownerId: true },
  })

  if (!business) {
    return { success: false, error: "Business not found" }
  }

  // Defense-in-depth: the session role says owner, but verify the ownerId too.
  if (business.ownerId !== userId) {
    return { success: false, error: "Only the business owner can delete the account" }
  }

  // The owner must type the business name exactly (trimmed).
  if (parsed.confirmName.trim() !== business.name.trim()) {
    return { success: false, error: "The name you typed does not match your business name" }
  }

  try {
    // 1. Cancel the subscription + 2. write the audit trail, atomically.
    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: businessId },
        data: { subscriptionStatus: "cancelled" },
      })

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: "delete_requested",
          entityType: "Business",
          entityId: businessId,
          oldValues: { subscriptionStatus: business.subscriptionStatus },
          newValues: { subscriptionStatus: "cancelled" },
          metadata: {
            note: "Owner requested account deletion; data removed within 30 days.",
            requestedAt: new Date().toISOString(),
          },
        },
      })
    })
  } catch (e) {
    console.error("requestAccountDeletion write error:", e)
    return { success: false, error: "Could not record your deletion request. Please try again." }
  }

  // 3. Notify the SAL team so they can complete the data removal. Sending mail
  //    is a best-effort side effect OUTSIDE the transaction — a mail hiccup must
  //    not roll back the recorded request, which is the source of truth.
  try {
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    })
    const ownerName = owner ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() : "Unknown"

    await sendEmail({
      to: "support@meetsal.ai",
      subject: `Account deletion request — ${business.name}`,
      replyTo: owner?.email || undefined,
      html: `
        <h2>Account deletion request</h2>
        <p>An owner has requested deletion of their SAL account.</p>
        <ul>
          <li><strong>Business:</strong> ${business.name}</li>
          <li><strong>Business ID:</strong> ${businessId}</li>
          <li><strong>Requested by:</strong> ${ownerName} (${owner?.email ?? "no email"})</li>
          <li><strong>User ID:</strong> ${userId}</li>
          <li><strong>Requested at:</strong> ${new Date().toISOString()}</li>
        </ul>
        <p>The subscription has been set to <strong>cancelled</strong> and an audit log
        entry was written. Please complete data removal within 30 days per the privacy policy.</p>
      `,
    })
  } catch (e) {
    // Logged, not surfaced — the request is already recorded.
    console.error("requestAccountDeletion email error:", e)
  }

  revalidatePath("/settings")
  return { success: true, data: undefined }
}
