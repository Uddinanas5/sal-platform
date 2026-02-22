"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext } from "@/lib/auth-utils"

export async function createMembershipPlan(data: {
  name: string
  description?: string
  price: number
  billingCycle: "monthly" | "quarterly" | "yearly" | "one_time"
  sessionsIncluded?: number
  discountPercent?: number
  serviceIds?: string[]
  benefits?: string[]
}) {
  const { businessId } = await getBusinessContext()

  const plan = await prisma.membershipPlan.create({
    data: {
      businessId,
      name: data.name,
      description: data.description,
      price: data.price,
      billingCycle: data.billingCycle,
      sessionsIncluded: data.sessionsIncluded,
      discountPercent: data.discountPercent,
      serviceIds: data.serviceIds || [],
      benefits: data.benefits || [],
    },
  })
  revalidatePath("/memberships")
  return plan
}

export async function updateMembershipPlan(
  id: string,
  data: {
    name?: string
    description?: string
    price?: number
    billingCycle?: "monthly" | "quarterly" | "yearly" | "one_time"
    sessionsIncluded?: number | null
    discountPercent?: number | null
    benefits?: string[]
    isActive?: boolean
  }
) {
  const { businessId } = await getBusinessContext()

  const plan = await prisma.membershipPlan.update({
    where: { id, businessId },
    data,
  })
  revalidatePath("/memberships")
  return plan
}

export async function deleteMembershipPlan(id: string) {
  const { businessId } = await getBusinessContext()

  await prisma.membershipPlan.delete({ where: { id, businessId } })
  revalidatePath("/memberships")
}

export async function createMembership(data: {
  clientId: string
  planId: string
  startDate: Date
}) {
  const plan = await prisma.membershipPlan.findUnique({ where: { id: data.planId } })
  if (!plan) throw new Error("Plan not found")

  const membership = await prisma.membership.create({
    data: {
      clientId: data.clientId,
      planId: data.planId,
      startDate: data.startDate,
      sessionsRemaining: plan.sessionsIncluded,
      nextBillingDate: plan.billingCycle === "one_time" ? null : data.startDate,
    },
  })
  revalidatePath("/memberships")
  return membership
}

export async function cancelMembership(id: string) {
  const { businessId } = await getBusinessContext()

  // Verify membership belongs to this business through its plan
  const membership = await prisma.membership.findFirst({
    where: { id, plan: { businessId } },
  })
  if (!membership) throw new Error("Membership not found")

  await prisma.membership.update({
    where: { id },
    data: {
      status: "cancelled_membership",
      cancelledAt: new Date(),
    },
  })
  revalidatePath("/memberships")
}

export async function pauseMembership(id: string) {
  const { businessId } = await getBusinessContext()

  // Verify membership belongs to this business through its plan
  const membership = await prisma.membership.findFirst({
    where: { id, plan: { businessId } },
  })
  if (!membership) throw new Error("Membership not found")

  await prisma.membership.update({
    where: { id },
    data: {
      status: "paused_membership",
      pausedAt: new Date(),
    },
  })
  revalidatePath("/memberships")
}

export async function resumeMembership(id: string) {
  const { businessId } = await getBusinessContext()

  // Verify membership belongs to this business through its plan
  const membership = await prisma.membership.findFirst({
    where: { id, plan: { businessId } },
  })
  if (!membership) throw new Error("Membership not found")

  await prisma.membership.update({
    where: { id },
    data: {
      status: "active_membership",
      pausedAt: null,
    },
  })
  revalidatePath("/memberships")
}
