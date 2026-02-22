import { auth } from "./auth"

export async function getBusinessContext() {
  const session = await auth()
  if (!session?.user) throw new Error("Not authenticated")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session.user as any).businessId
  if (!businessId) throw new Error("No business context")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { userId: session.user.id, businessId, role: (session.user as any).role as string }
}
