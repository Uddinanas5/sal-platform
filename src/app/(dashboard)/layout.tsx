import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { decideBillingGate } from "@/lib/billing/gate"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"

export const dynamic = "force-dynamic"

// SAFE-BY-DEFAULT BILLING GATE.
//
// This server layout loads the business's SAL subscription state and decides
// whether to gate. The guiding rule: NEVER lock out a salon that never agreed
// to pay. Concretely:
//   - A business that NEVER subscribed (no stripeSubscriptionId) keeps FULL
//     access forever. This is the default `subscriptionStatus = active` seed
//     state for every business and covers all founding beta salons.
//   - billingExempt businesses are NEVER gated (founder waiver).
//   - past_due → NON-blocking amber banner only (full access retained).
//   - HARD gate (redirect to /settings billing tab) ONLY when ALL hold:
//       status === "cancelled"  AND  a stripeSubscriptionId was ever set
//       AND  !billingExempt.
//     i.e. the salon DID subscribe and then the subscription ended — they must
//     resubscribe. /settings and /api are always allowed through so they can
//     actually pay or call the portal.
export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessId = (session?.user as any)?.businessId as string | undefined

  let billingBanner: "past_due" | null = null

  if (businessId) {
    const business = await prisma.business
      .findUnique({
        where: { id: businessId },
        select: {
          subscriptionStatus: true,
          stripeSubscriptionId: true,
          billingExempt: true,
        },
      })
      .catch(() => null)

    if (business) {
      const decision = decideBillingGate({
        status: business.subscriptionStatus,
        hasSubscription: Boolean(business.stripeSubscriptionId),
        billingExempt: business.billingExempt,
      })

      if (decision.kind === "gate") {
        const headerList = await headers()
        const pathname = headerList.get("x-pathname") ?? ""
        // Always allow the billing settings + API through so they can resubscribe.
        // (This layout only wraps (dashboard) routes; /api lives outside it, but
        // we guard defensively in case of future nesting.)
        const isAllowed =
          pathname.startsWith("/settings") || pathname.startsWith("/api")
        if (!isAllowed) {
          redirect("/settings?tab=billing")
        }
      } else if (decision.kind === "banner") {
        // Non-blocking: keep full access, just surface a banner.
        billingBanner = decision.banner
      }
    }
  }

  return (
    <DashboardLayout billingBanner={billingBanner}>{children}</DashboardLayout>
  )
}
