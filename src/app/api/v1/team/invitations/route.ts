import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { SignJWT } from "jose"
import { sendEmail } from "@/lib/email"
import { staffInvitationEmail } from "@/lib/email-templates"

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"
const INVITE_TTL_HOURS = 72

const sendInvitationSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["staff", "admin"]),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const invitations = await prisma.staffInvitation.findMany({
    where: { businessId: ctx.businessId },
    include: { invitedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  })
  return apiSuccess(invitations)
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = sendInvitationSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  if (parsed.data.role === "admin" && !hasRole(ctx.role, "owner")) {
    return ERRORS.BAD_REQUEST("Only the owner can invite admins")
  }

  const email = parsed.data.email.toLowerCase().trim()

  const [business, inviter] = await Promise.all([
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { firstName: true, lastName: true } }),
  ])
  if (!business) return ERRORS.NOT_FOUND("Business")
  if (!inviter) return ERRORS.NOT_FOUND("Inviter")

  const existingStaff = await prisma.staff.findFirst({
    where: { user: { email }, primaryLocation: { businessId: ctx.businessId }, isActive: true, deletedAt: null },
  })
  if (existingStaff) return ERRORS.BAD_REQUEST("A staff member with this email already exists")

  await prisma.staffInvitation.updateMany({
    where: { businessId: ctx.businessId, email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)
  const invitation = await prisma.staffInvitation.create({
    data: {
      businessId: ctx.businessId,
      email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
      invitedById: ctx.userId,
      expiresAt,
    },
  })

  const token = await new SignJWT({
    purpose: "staff-invite",
    invitationId: invitation.id,
    email,
    businessId: ctx.businessId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${INVITE_TTL_HOURS}h`)
    .sign(SECRET)

  const acceptUrl = `${APP_URL}/accept-invitation?token=${token}`
  const inviterName = `${inviter.firstName} ${inviter.lastName}`
  const inviteeName = `${parsed.data.firstName} ${parsed.data.lastName}`

  await sendEmail({
    to: email,
    subject: `You're invited to join ${business.name} on SAL`,
    html: staffInvitationEmail({
      inviteeName,
      inviterName,
      businessName: business.name,
      role: parsed.data.role,
      acceptUrl,
      expiresInHours: INVITE_TTL_HOURS,
    }),
  })

  return apiSuccess({ invitationId: invitation.id }, 201)
}
