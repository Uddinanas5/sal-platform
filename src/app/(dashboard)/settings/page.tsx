import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getResources } from "@/lib/queries/resources"
import { getServices } from "@/lib/queries/services"
import { getInvitations } from "@/lib/queries/invitations"
import { hasRole } from "@/lib/permissions"
import { getBookingSettings } from "@/lib/actions/booking-settings"
import { getOnlinePresenceSettings, getPaymentSettings, getNotificationSettings } from "@/lib/actions/settings"
import SettingsClient from "./client"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined
  const userId = session?.user?.id as string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = ((session?.user as any)?.role as string | undefined) ?? "staff"

  const isAdminOrOwner = hasRole(role, "admin")

  let resources: Awaited<ReturnType<typeof getResources>> = []
  let services: Awaited<ReturnType<typeof getServices>> = []

  try {
    resources = await getResources(businessId)
  } catch {
    resources = []
  }

  try {
    services = await getServices(businessId)
  } catch {
    services = []
  }

  const business = businessId ? await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, phone: true, email: true, timezone: true, currency: true, slug: true },
  }) : null

  const location = businessId ? await prisma.location.findFirst({
    where: { businessId, isPrimary: true },
    select: { addressLine1: true, city: true, state: true, postalCode: true },
  }) : null

  const serviceOptions = services.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
  }))

  // Fetch booking settings (returns schema defaults if not set or on error)
  const bookingSettings = await getBookingSettings(businessId ?? "").catch(() => ({
    minLeadTime: "none" as const,
    maxAdvanceBooking: "1m" as const,
    cancellationWindow: "24h" as const,
    autoConfirm: true,
    allowDoubleBooking: false,
    requireDeposit: false,
    depositType: "percentage" as const,
    depositAmount: 0,
    depositApplyOverAmount: 0,
    requiredFields: { phone: true, email: true, address: false, notes: false },
    customQuestions: [],
  }))

  // Fetch online presence settings (returns schema defaults if not set or on error)
  const onlinePresenceSettings = await getOnlinePresenceSettings(businessId ?? "").catch(() => ({
    buttonColor: "#059669",
    buttonText: "Book Now",
    widgetSize: "medium" as const,
    socialLinks: { instagram: "", facebook: "", tiktok: "", website: "" },
  }))

  // Fetch notification settings (returns schema defaults if not set or on error)
  const notificationSettings = await getNotificationSettings(businessId ?? "").catch(() => ({
    emailTemplates: {
      bookingConfirmation: "",
      appointmentReminder: "",
      cancellationNotice: "",
      followUp: "",
    },
    smsTemplates: {
      bookingConfirmation: "",
      appointmentReminder: "",
      cancellationNotice: "",
      followUp: "",
    },
    internalAlerts: {
      newBooking: true,
      cancellation: true,
      lowInventory: false,
      dailySummary: true,
    },
  }))

  // Fetch payment settings (returns schema defaults if not set or on error)
  const paymentSettings = await getPaymentSettings(businessId ?? "").catch(() => ({
    paymentMethods: { cash: true, card: true, giftCards: false, splitPayment: false },
    taxRate: "8.875",
    taxName: "Sales Tax",
    taxOnProducts: true,
    taxOnServices: true,
    enableTipping: true,
    tipAmounts: ["15", "18", "20"],
    customTip: true,
    autoSendReceipt: true,
    receiptChannel: "email" as const,
    receiptFooter:
      "Thank you for choosing SAL Beauty Studio! We look forward to seeing you again.",
  }))

  // Fetch team data only for admin/owner
  let invitations: Awaited<ReturnType<typeof getInvitations>> = []
  let teamMembers: Array<{
    staffId: string
    userId: string
    name: string
    email: string
    role: string
    avatarUrl?: string | null
  }> = []

  if (isAdminOrOwner && businessId) {
    try {
      invitations = await getInvitations(businessId)
    } catch {
      invitations = []
    }

    try {
      const staffList = await prisma.staff.findMany({
        where: { primaryLocation: { businessId }, isActive: true, deletedAt: null },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      })
      teamMembers = staffList.map((s) => ({
        staffId: s.id,
        userId: s.user.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        email: s.user.email,
        role: s.user.role,
        avatarUrl: s.user.avatarUrl,
      }))
    } catch {
      teamMembers = []
    }
  }

  return (
    <SettingsClient
      resources={resources}
      services={serviceOptions}
      initialBusiness={business}
      initialLocation={location}
      role={role}
      currentUserId={userId ?? ""}
      invitations={invitations}
      teamMembers={teamMembers}
      bookingSettings={bookingSettings}
      businessSlug={business?.slug ?? ""}
      onlinePresenceSettings={onlinePresenceSettings}
      paymentSettings={paymentSettings}
      notificationSettings={notificationSettings}
    />
  )
}
