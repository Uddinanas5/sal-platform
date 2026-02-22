import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { BookingPageClient } from "./client"

export const dynamic = "force-dynamic"

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>
}) {
  const { businessSlug } = await params

  // Look up business by slug
  const business = await prisma.business.findFirst({
    where: { slug: businessSlug, deletedAt: null },
  })

  if (!business) {
    notFound()
  }

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

  // Fetch staff for this business
  const dbStaff = await prisma.staff.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      primaryLocation: { businessId: business.id },
    },
    include: {
      user: true,
      staffServices: true,
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
    color: s.color || "#059669",
    isActive: s.isActive,
    commission: Number(s.commissionRate),
  }))

  return (
    <BookingPageClient
      businessSlug={businessSlug}
      businessId={business.id}
      businessName={business.name}
      services={services as never[]} // eslint-disable-line @typescript-eslint/no-explicit-any
      staff={staff as never[]} // eslint-disable-line @typescript-eslint/no-explicit-any
    />
  )
}
