import { auth } from "./auth"
import { hasRole, type AppRole } from "./permissions"

export type BusinessContext = {
  userId: string
  businessId: string
  role: string
}

export async function getBusinessContext(): Promise<BusinessContext> {
  const session = await auth()
  if (!session?.user) throw new Error("Not authenticated")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session.user as any).businessId
  if (!businessId) throw new Error("No business context")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { userId: session.user.id, businessId, role: (session.user as any).role as string }
}

export async function requireMinRole(minimum: AppRole): Promise<BusinessContext> {
  const ctx = await getBusinessContext()
  if (!hasRole(ctx.role, minimum)) {
    throw new Error(`Insufficient permissions: requires ${minimum} role`)
  }
  return ctx
}
