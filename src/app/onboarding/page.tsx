import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { OnboardingClient } from "./client"

export const dynamic = "force-dynamic"

export default async function OnboardingPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const business = await prisma.business.findFirst({
    where: { ownerId: session.user.id },
    include: {
      locations: {
        where: { isPrimary: true },
        take: 1,
      },
      services: {
        where: { isActive: true },
        take: 1,
      },
    },
  })

  if (!business) {
    redirect("/register")
  }

  // If business already has services, onboarding is done
  if (business.services.length > 0) {
    redirect("/dashboard")
  }

  const location = business.locations[0] ?? null

  return (
    <OnboardingClient
      business={{
        id: business.id,
        name: business.name,
        slug: business.slug,
        phone: business.phone ?? "",
        timezone: business.timezone,
      }}
      location={
        location
          ? {
              id: location.id,
              addressLine1: location.addressLine1,
              city: location.city,
              state: location.state ?? "",
              postalCode: location.postalCode ?? "",
              country: location.country,
            }
          : null
      }
    />
  )
}
