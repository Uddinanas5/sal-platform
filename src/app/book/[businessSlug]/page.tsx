import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { BookingPageClient } from "./client"
import { getPublicBookingSettings } from "@/lib/actions/booking-settings"
import { getOnlinePresenceSettings } from "@/lib/actions/settings"
import { getPublicBookingStaff } from "@/lib/queries/public-booking"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as { code?: string }).code
  const causeCode = (error as { cause?: { code?: string } }).cause?.code
  // This page only does read queries on findFirst/findMany, which return null
  // rather than throwing for "no row found". So a thrown PrismaClient*Error
  // here is virtually always an infra problem (DB down, pool exhausted, socket
  // dropped). We render an unavailable card with 200 status rather than
  // throwing — Next strips error metadata before handing the error to the
  // boundary in prod, so the boundary can't reliably show friendly copy.
  return (
    error.name === "PrismaClientInitializationError" ||
    error.name === "PrismaClientKnownRequestError" ||
    error.name === "PrismaClientRustPanicError" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1008" ||
    code === "P1017" ||
    code === "P2024" ||
    code === "ECONNREFUSED" ||
    causeCode === "ECONNREFUSED"
  )
}

function BookingUnavailable({ businessName }: { businessName?: string }) {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">
            Booking is temporarily unavailable
          </h2>
          <p className="text-sm text-muted-foreground">
            {businessName
              ? `We're having trouble loading the booking page for ${businessName}.`
              : "We're having trouble loading this booking page right now."}{" "}
            Please try again in a few minutes, or call the salon directly to book.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-sal-500 px-6 py-2.5 text-sm font-medium text-mint hover:bg-sal-50 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessSlug: string }>
}): Promise<Metadata> {
  const { businessSlug } = await params
  let business: { name: string } | null = null
  try {
    business = await prisma.business.findFirst({
      where: { slug: businessSlug, deletedAt: null },
      select: { name: true },
    })
  } catch {
    // Metadata is best-effort; the page handler will surface the real error.
    business = null
  }
  return {
    title: business ? `Book with ${business.name}` : "Book an Appointment",
    description: business
      ? `Book your next appointment with ${business.name}`
      : "Book your next appointment online",
  }
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>
}) {
  const { businessSlug } = await params

  // Look up business by slug. Distinguish connection errors (render
  // unavailable, 200) from "no such slug" (notFound, 404).
  let business: { id: string; name: string; timezone: string | null } | null
  try {
    business = await prisma.business.findFirst({
      where: { slug: businessSlug, deletedAt: null },
      select: {
        id: true,
        name: true,
        timezone: true,
      },
    })
  } catch (error) {
    if (isConnectionError(error)) {
      console.error("Public booking DB unreachable:", error)
      return <BookingUnavailable />
    }
    throw error
  }

  if (!business) {
    notFound()
  }

  // Fan out the remaining reads in parallel — they share the same DB, so any
  // infra failure across the lot collapses to one unavailable render.
  let bookingSettings, primaryLocation, dbBusinessHours, dbServices, staff, onlinePresence
  try {
    ;[bookingSettings, primaryLocation, dbBusinessHours, dbServices, staff, onlinePresence] = await Promise.all([
      getPublicBookingSettings(business.id),
      prisma.location.findFirst({
        where: { businessId: business.id, isPrimary: true, deletedAt: null },
        select: { id: true },
      }),
      prisma.businessHours.findMany({
        where: {
          location: { businessId: business.id, isPrimary: true },
        },
        orderBy: { dayOfWeek: "asc" },
      }),
      prisma.service.findMany({
        where: { businessId: business.id, isActive: true, deletedAt: null, isOnlineBooking: true },
        include: { category: true },
        orderBy: { sortOrder: "asc" },
      }),
      getPublicBookingStaff(business.id),
      getOnlinePresenceSettings(business.id),
    ])
  } catch (error) {
    if (isConnectionError(error)) {
      console.error("Public booking DB unreachable:", error)
      return <BookingUnavailable businessName={business.name} />
    }
    throw error
  }

  // Derive timezone from business
  const timezone = business.timezone || "UTC"

  const businessHours = dbBusinessHours.map((bh) => ({
    dayOfWeek: bh.dayOfWeek,
    openTime: bh.openTime ? bh.openTime.toISOString() : null,
    closeTime: bh.closeTime ? bh.closeTime.toISOString() : null,
    isClosed: bh.isClosed,
  }))

  // A service with no active, bookable staff who perform it can never produce a
  // slot — and a waitlist can't conjure a barber for it — so drop it from the
  // catalog entirely rather than letting it dead-end on an empty step 3.
  const bookableServiceIds = new Set(
    staff
      .filter((s) => s.isActive && s.canAcceptBookings)
      .flatMap((s) => s.services),
  )

  const services = dbServices
    .filter((s) => bookableServiceIds.has(s.id))
    .map((s: typeof dbServices[number]) => ({
      id: s.id,
      name: s.name,
      description: s.description || "",
      duration: s.durationMinutes,
      price: Number(s.price),
      category: s.category?.name || "Uncategorized",
      color: s.color || "#059669",
      isActive: s.isActive,
    }))

  return (
    <BookingPageClient
      businessSlug={businessSlug}
      businessId={business.id}
      businessName={business.name}
      locationId={primaryLocation?.id ?? ""}
      services={services as never[]} // eslint-disable-line @typescript-eslint/no-explicit-any
      staff={staff}
      businessHours={businessHours}
      maxAdvanceBooking={bookingSettings.maxAdvanceBooking}
      timezone={timezone}
      socialLinks={onlinePresence.socialLinks}
    />
  )
}
