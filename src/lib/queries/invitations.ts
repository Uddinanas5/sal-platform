import { prisma } from "@/lib/prisma"

export async function getInvitations(businessId: string) {
  return prisma.staffInvitation.findMany({
    where: { businessId },
    include: {
      invitedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export type InvitationWithInviter = Awaited<ReturnType<typeof getInvitations>>[number]
