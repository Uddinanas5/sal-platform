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

  // Load any previously-saved working hours so resuming onboarding shows what the
  // owner already entered instead of silently reverting to defaults (and then
  // overwriting the saved rows when they click Next through step 2).
  const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const savedHoursRows = location
    ? await prisma.businessHours.findMany({ where: { locationId: location.id } })
    : []
  const hhmm = (d: Date | null) =>
    d ? `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` : "09:00"
  const initialHours = savedHoursRows.length
    ? savedHoursRows
        .slice()
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
        .map((h) => ({
          dayOfWeek: h.dayOfWeek,
          label: DAY_LABELS[h.dayOfWeek] ?? `Day ${h.dayOfWeek}`,
          isWorking: !h.isClosed,
          openTime: hhmm(h.openTime),
          closeTime: hhmm(h.closeTime),
        }))
    : null

  return (
    <OnboardingClient
      initialHours={initialHours}
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
