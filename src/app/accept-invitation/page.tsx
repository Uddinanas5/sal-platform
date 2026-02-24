import { jwtVerify } from "jose"
import { prisma } from "@/lib/prisma"
import AcceptInvitationClient from "./client"

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

export type InvitationState =
  | { status: "invalid_token" }
  | { status: "expired" }
  | { status: "revoked" }
  | { status: "already_accepted" }
  | {
      status: "ready"
      invitationId: string
      token: string
      email: string
      firstName: string
      businessName: string
      role: string
      isNewUser: boolean
    }

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <AcceptInvitationClient state={{ status: "invalid_token" }} />
  }

  let payload: { purpose: string; invitationId: string; email: string; businessId: string }
  try {
    const result = await jwtVerify(token, SECRET)
    payload = result.payload as typeof payload
  } catch {
    return <AcceptInvitationClient state={{ status: "invalid_token" }} />
  }

  if (payload.purpose !== "staff-invite") {
    return <AcceptInvitationClient state={{ status: "invalid_token" }} />
  }

  const invitation = await prisma.staffInvitation.findUnique({
    where: { id: payload.invitationId },
    include: { business: { select: { name: true } } },
  })

  if (!invitation) {
    return <AcceptInvitationClient state={{ status: "invalid_token" }} />
  }

  if (invitation.revokedAt) {
    return <AcceptInvitationClient state={{ status: "revoked" }} />
  }

  if (invitation.acceptedAt) {
    return <AcceptInvitationClient state={{ status: "already_accepted" }} />
  }

  if (invitation.expiresAt < new Date()) {
    return <AcceptInvitationClient state={{ status: "expired" }} />
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { passwordHash: true },
  })

  const isNewUser = !existingUser || !existingUser.passwordHash

  return (
    <AcceptInvitationClient
      state={{
        status: "ready",
        invitationId: invitation.id,
        token,
        email: invitation.email,
        firstName: invitation.firstName,
        businessName: invitation.business.name,
        role: invitation.role,
        isNewUser,
      }}
    />
  )
}
