import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { lifecycleEmail } from "@/lib/email-templates"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()
  const { id } = await params

  // Tenant-scoped load so we can apply the same consent-first email gate as the
  // dashboard action and report honestly whether an email actually went out.
  // WaitlistEntry has no `client` relation (only clientId) — load it separately.
  const existing = await prisma.waitlistEntry.findFirst({
    where: { id, businessId: ctx.businessId },
    select: { id: true, clientId: true, business: { select: { name: true } } },
  })
  if (!existing) return ERRORS.NOT_FOUND("Waitlist entry")

  const entry = await prisma.waitlistEntry.update({
    where: { id, businessId: ctx.businessId },
    data: { status: "notified", notifiedAt: new Date() },
  })

  let emailed = false
  const client = await prisma.client.findFirst({
    where: { id: existing.clientId, businessId: ctx.businessId },
    select: { firstName: true, email: true, emailConsent: true },
  })
  if (client?.email && client.emailConsent) {
    const businessName = existing.business?.name || "your salon"
    const res = await sendEmail({
      to: client.email,
      subject: `A spot may have opened up at ${businessName}`,
      html: lifecycleEmail({
        title: "A spot may be available",
        body: `Hi ${client.firstName || "there"},\n\nGood news — a spot may have just opened up at ${businessName}. You're on our waitlist, so we wanted to let you know right away.\n\nReply to this email or give us a call to grab the slot before it's gone.`,
      }),
    })
    emailed = !!res?.success
  }

  return apiSuccess({ ...entry, emailed })
}
