"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext, requireMinRole } from "@/lib/auth-utils"

const billingCycleEnum = z.enum(["monthly", "quarterly", "yearly", "one_time"])

const createMembershipPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  billingCycle: billingCycleEnum,
  sessionsIncluded: z.number().int().nonnegative().optional(),
  discountPercent: z.number().nonnegative().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  benefits: z.array(z.string()).optional(),
})

const updateMembershipPlanSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    price: z.number().nonnegative().optional(),
    billingCycle: billingCycleEnum.optional(),
    sessionsIncluded: z.number().int().nonnegative().nullable().optional(),
    discountPercent: z.number().nonnegative().nullable().optional(),
    benefits: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  }),
})

const idSchema = z.object({ id: z.string().uuid() })

const createMembershipSchema = z.object({
  clientId: z.string().uuid(),
  planId: z.string().uuid(),
  startDate: z.coerce.date(),
})

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
  try {
    const parsed = createMembershipPlanSchema.parse(data)

    const { businessId } = await requireMinRole("admin")

    const plan = await prisma.membershipPlan.create({
      data: {
        businessId,
        name: parsed.name,
        description: parsed.description,
        price: parsed.price,
        billingCycle: parsed.billingCycle,
        sessionsIncluded: parsed.sessionsIncluded,
        discountPercent: parsed.discountPercent,
        serviceIds: parsed.serviceIds || [],
        benefits: parsed.benefits || [],
      },
    })
    revalidatePath("/memberships")
    return plan
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
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
  try {
    const parsed = updateMembershipPlanSchema.parse({ id, data })

    const { businessId } = await requireMinRole("admin")

    const plan = await prisma.membershipPlan.update({
      where: { id: parsed.id, businessId },
      data: parsed.data,
    })
    revalidatePath("/memberships")
    return plan
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function deleteMembershipPlan(id: string) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await requireMinRole("admin")

    await prisma.membershipPlan.delete({ where: { id: parsed.id, businessId } })
    revalidatePath("/memberships")
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function createMembership(data: {
  clientId: string
  planId: string
  startDate: Date
}) {
  try {
    const parsed = createMembershipSchema.parse(data)

    const plan = await prisma.membershipPlan.findUnique({ where: { id: parsed.planId } })
    if (!plan) throw new Error("Plan not found")

    const membership = await prisma.membership.create({
      data: {
        clientId: parsed.clientId,
        planId: parsed.planId,
        startDate: parsed.startDate,
        sessionsRemaining: plan.sessionsIncluded,
        nextBillingDate: plan.billingCycle === "one_time" ? null : parsed.startDate,
      },
    })
    revalidatePath("/memberships")
    return membership
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function cancelMembership(id: string) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await getBusinessContext()

    // Verify membership belongs to this business through its plan
    const membership = await prisma.membership.findFirst({
      where: { id: parsed.id, plan: { businessId } },
    })
    if (!membership) throw new Error("Membership not found")

    await prisma.membership.update({
      where: { id: parsed.id },
      data: {
        status: "cancelled_membership",
        cancelledAt: new Date(),
      },
    })
    revalidatePath("/memberships")
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function pauseMembership(id: string) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await getBusinessContext()

    // Verify membership belongs to this business through its plan
    const membership = await prisma.membership.findFirst({
      where: { id: parsed.id, plan: { businessId } },
    })
    if (!membership) throw new Error("Membership not found")

    await prisma.membership.update({
      where: { id: parsed.id },
      data: {
        status: "paused_membership",
        pausedAt: new Date(),
      },
    })
    revalidatePath("/memberships")
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}

export async function resumeMembership(id: string) {
  try {
    const parsed = idSchema.parse({ id })

    const { businessId } = await getBusinessContext()

    // Verify membership belongs to this business through its plan
    const membership = await prisma.membership.findFirst({
      where: { id: parsed.id, plan: { businessId } },
    })
    if (!membership) throw new Error("Membership not found")

    await prisma.membership.update({
      where: { id: parsed.id },
      data: {
        status: "active_membership",
        pausedAt: null,
      },
    })
    revalidatePath("/memberships")
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }
}
