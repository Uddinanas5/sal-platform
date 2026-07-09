import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { resolveBusinessRole } from "@/lib/auth-utils"
import { hasRole } from "@/lib/permissions"
import { getStaff } from "@/lib/queries/staff"
import { getServices } from "@/lib/queries/services"
import { StaffClient } from "./client"

export const dynamic = "force-dynamic"
export default async function StaffPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined
  if (!businessId) redirect("/onboarding")

  // Admin-only: the staff roster exposes commission rates + contact PII. The
  // middleware gate keys on the STALE 7-day JWT role, so re-check the LIVE DB
  // role here and bounce anyone not currently admin+ (L-042).
  const userId = session?.user?.id as string | undefined
  const liveRole = userId ? await resolveBusinessRole(userId, businessId) : null
  if (!hasRole(liveRole, "admin")) redirect("/dashboard")

  const [staff, services] = await Promise.all([getStaff(businessId), getServices(businessId)])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <StaffClient initialStaff={staff as any} services={services as any} />
}
