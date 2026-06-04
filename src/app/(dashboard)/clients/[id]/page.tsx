import { getClientById } from "@/lib/queries/clients"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { ClientDetailClient } from "./client"

export const dynamic = "force-dynamic"
export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId
  if (!session?.user || !businessId) redirect("/login")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any).role as string | undefined

  const client = await getClientById(params.id, businessId)
  if (!client) notFound()

  // Resolve the signed-in user's staff profile within THIS business so the notes
  // log can gate "delete your own note" (admins/owners may delete any note).
  const currentStaff = await prisma.staff.findFirst({
    where: { userId: session.user.id, primaryLocation: { businessId } },
    select: { id: true },
  })

  return (
    <ClientDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client={client as any}
      currentStaffId={currentStaff?.id ?? null}
      currentRole={role ?? "staff"}
    />
  )
}
