import { prisma } from "@/lib/prisma"

/**
 * `User.role` is a single GLOBAL column shared across EVERY business a user belongs
 * to (resolveBusinessRole returns it verbatim for any active staff/owner). So
 * changing a user's role from one business would silently escalate or downgrade
 * their privileges at OTHER businesses too — a cross-tenant privilege escalation.
 *
 * Returns true when the target ALSO belongs elsewhere (owns another business, or is
 * an active staff member of another business), in which case their role must NOT be
 * changed from this business. Owner-role targets are rejected separately by each
 * caller before this check.
 *
 * Shared by the server action (updateTeamMemberRole), the REST route
 * (PATCH /api/v1/team/[userId]) and the MCP tool (update-team-member-role) so the
 * guard can't drift out of one of them again (which is exactly how the REST/MCP
 * paths ended up unguarded).
 */
export async function belongsToAnotherBusiness(
  targetUserId: string,
  businessId: string,
  client: Pick<typeof prisma, "business" | "staff"> = prisma,
): Promise<boolean> {
  const [ownsOther, staffElsewhere] = await Promise.all([
    client.business.findFirst({
      where: { ownerId: targetUserId, id: { not: businessId } },
      select: { id: true },
    }),
    client.staff.findFirst({
      where: {
        userId: targetUserId,
        isActive: true,
        deletedAt: null,
        primaryLocation: { businessId: { not: businessId } },
      },
      select: { id: true },
    }),
  ])
  return Boolean(ownsOther || staffElsewhere)
}

export const CROSS_TENANT_ROLE_CHANGE_ERROR =
  "This person also belongs to another business, so their role can't be changed from here."
