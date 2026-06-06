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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session?.user as any)?.role as string | undefined

  let billingBanner: "past_due" | "paused" | null = null

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
        // Staff CANNOT reach /settings — it's in STAFF_BLOCKED_ROUTES, so the
        // edge middleware redirects /settings → /dashboard while this layout
        // would redirect /dashboard → /settings: an infinite ping-pong. Staff
        // also can't resubscribe (owner-only). So for staff we render a static
        // terminal screen instead of redirecting — no redirect, no loop.
        if (role === "staff") {
          return (
            <div className="min-h-screen flex items-center justify-center bg-cream p-6">
              <div className="max-w-md w-full rounded-xl border bg-background p-8 text-center shadow-sm">
                <h1 className="text-lg font-heading font-semibold text-foreground">
                  Access paused
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  This salon&apos;s SAL subscription has ended. Please contact your
                  salon owner to restore access.
                </p>
              </div>
            </div>
          )
        }

        const headerList = await headers()
        const pathname = headerList.get("x-pathname") ?? ""
        // Always allow the billing settings + API through so the owner/admin can
        // resubscribe. (This layout only wraps (dashboard) routes; /api lives
        // outside it, but we guard defensively in case of future nesting.)
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
