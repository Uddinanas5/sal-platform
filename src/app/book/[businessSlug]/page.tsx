import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { BookingPageClient } from "./client"
import { getPublicBookingSettings } from "@/lib/actions/booking-settings"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as { code?: string }).code
  return (
    error.name === "PrismaClientInitializationError" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1017"
  )
}

class ServiceUnavailableError extends Error {
  constructor(message = "Database unreachable") {
    super(message)
    this.name = "ServiceUnavailableError"
  }
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

  // Look up business by slug. Distinguish connection errors (503) from
  // "no such slug" (404) — without this, a DB outage returns 500 with a
  // 404 body, which is confusing for both bots and humans.
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
      throw new ServiceUnavailableError()
    }
    throw error
  }

  if (!business) {
    notFound()
  }

  // Fetch booking settings
  const bookingSettings = await getPublicBookingSettings(business.id)

  // Derive timezone from business
  const timezone = business.timezone || "UTC"

  // Fetch primary location
  const primaryLocation = await prisma.location.findFirst({
    where: { businessId: business.id, isPrimary: true, deletedAt: null },
    select: { id: true },
  })

  // Fetch business hours from the primary location
  const dbBusinessHours = await prisma.businessHours.findMany({
    where: {
      location: { businessId: business.id, isPrimary: true },
    },
    orderBy: { dayOfWeek: "asc" },
  })

  const businessHours = dbBusinessHours.map((bh) => ({
    dayOfWeek: bh.dayOfWeek,
    openTime: bh.openTime ? bh.openTime.toISOString() : null,
    closeTime: bh.closeTime ? bh.closeTime.toISOString() : null,
    isClosed: bh.isClosed,
  }))

  // Fetch services for this business
  const dbServices = await prisma.service.findMany({
    where: { businessId: business.id, isActive: true, deletedAt: null, isOnlineBooking: true },
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  })

  const services = dbServices.map((s: typeof dbServices[number]) => ({
    id: s.id,
    name: s.name,
    description: s.description || "",
    duration: s.durationMinutes,
    price: Number(s.price),
    category: s.category?.name || "Uncategorized",
    color: s.color || "#059669",
    isActive: s.isActive,
  }))

  // Fetch staff for this business (including schedules)
  const dbStaff = await prisma.staff.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      primaryLocation: { businessId: business.id },
    },
    include: {
      user: true,
      staffServices: true,
      staffSchedules: true,
    },
    orderBy: { sortOrder: "asc" },
  })

  const staff = dbStaff.map((s) => ({
    id: s.id,
    name: `${s.user.firstName} ${s.user.lastName}`,
    email: s.user.email,
    phone: s.user.phone || "",
    avatar: s.user.avatarUrl || undefined,
    role: s.user.role === "admin" ? "admin" as const : s.user.role === "owner" ? "admin" as const : "staff" as const,
    services: s.staffServices.map((ss: typeof s.staffServices[number]) => ss.serviceId),
    workingHours: {} as Record<string, { start: string; end: string } | null>,
    schedules: s.staffSchedules.map((sch) => ({
      dayOfWeek: sch.dayOfWeek,
      startTime: sch.startTime.toISOString(),
      endTime: sch.endTime.toISOString(),
      isWorking: sch.isWorking,
    })),
    color: s.color || "#059669",
    isActive: s.isActive,
    commission: Number(s.commissionRate),
  }))

  return (
    <BookingPageClient
      businessSlug={businessSlug}
      businessId={business.id}
      businessName={business.name}
      locationId={primaryLocation?.id ?? ""}
      services={services as never[]} // eslint-disable-line @typescript-eslint/no-explicit-any
      staff={staff as never[]} // eslint-disable-line @typescript-eslint/no-explicit-any
      businessHours={businessHours}
      maxAdvanceBooking={bookingSettings.maxAdvanceBooking}
      timezone={timezone}
    />
  )
}
