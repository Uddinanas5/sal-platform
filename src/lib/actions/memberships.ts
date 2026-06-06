"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getBusinessContext, requireMinRole } from "@/lib/auth-utils"
import { assertServicesOwned } from "@/lib/ownership"

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

// Plain (serializable) shape returned to the client — never raw Prisma rows,
// because Decimal/Date don't cross the server→client boundary cleanly.
export type PlanResult = {
  id: string
  name: string
  description: string | null
  price: number
  billingCycle: "monthly" | "quarterly" | "yearly" | "one_time"
  sessionsIncluded: number | null
  discountPercent: number | null
  serviceIds: string[]
  benefits: string[]
  isActive: boolean
}

const billingCycleEnum = z.enum(["monthly", "quarterly", "yearly", "one_time"])

const createMembershipPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  billingCycle: billingCycleEnum,
  sessionsIncluded: z.number().int().nonnegative().optional(),
  discountPercent: z.number().nonnegative().max(100).optional(),
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
    discountPercent: z.number().nonnegative().max(100).nullable().optional(),
    benefits: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  }),
})

const idSchema = z.object({ id: z.string().uuid() })

const toggleMembershipPlanSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
})

const createMembershipSchema = z.object({
  clientId: z.string().uuid(),
  planId: z.string().uuid(),
  startDate: z.coerce.date(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializePlan(p: any): PlanResult {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    price: Number(p.price),
    billingCycle: p.billingCycle,
    sessionsIncluded: p.sessionsIncluded ?? null,
    discountPercent: p.discountPercent != null ? Number(p.discountPercent) : null,
    serviceIds: p.serviceIds ?? [],
    benefits: p.benefits ?? [],
    isActive: p.isActive,
  }
}

export async function createMembershipPlan(data: {
  name: string
  description?: string
  price: number
  billingCycle: "monthly" | "quarterly" | "yearly" | "one_time"
  sessionsIncluded?: number
  discountPercent?: number
  serviceIds?: string[]
  benefits?: string[]
}): Promise<ActionResult<PlanResult>> {
  let parsed: z.infer<typeof createMembershipPlanSchema>
  try {
    parsed = createMembershipPlanSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    const { businessId } = await requireMinRole("admin")
    await assertServicesOwned(parsed.serviceIds ?? [], businessId)

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
    return { success: true, data: serializePlan(plan) }
  } catch (e) {
    console.error("createMembershipPlan error:", e)
    return { success: false, error: (e as Error).message }
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
): Promise<ActionResult<PlanResult>> {
  let parsed: z.infer<typeof updateMembershipPlanSchema>
  try {
    parsed = updateMembershipPlanSchema.parse({ id, data })
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    const { businessId } = await requireMinRole("admin")

    // Scope by businessId in the WHERE so a foreign plan id updates nothing
    // (updateMany returns count:0 rather than touching another tenant's row).
    const { count } = await prisma.membershipPlan.updateMany({
      where: { id: parsed.id, businessId },
      data: parsed.data,
    })
    if (count === 0) return { success: false, error: "Plan not found" }

    const plan = await prisma.membershipPlan.findFirst({ where: { id: parsed.id, businessId } })
    revalidatePath("/memberships")
    return { success: true, data: serializePlan(plan) }
  } catch (e) {
    console.error("updateMembershipPlan error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleMembershipPlan(
  id: string,
  isActive: boolean
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  let parsed: z.infer<typeof toggleMembershipPlanSchema>
  try {
    parsed = toggleMembershipPlanSchema.parse({ id, isActive })
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    const { businessId } = await requireMinRole("admin")

    const { count } = await prisma.membershipPlan.updateMany({
      where: { id: parsed.id, businessId },
      data: { isActive: parsed.isActive },
    })
    if (count === 0) return { success: false, error: "Plan not found" }

    revalidatePath("/memberships")
    return { success: true, data: { id: parsed.id, isActive: parsed.isActive } }
  } catch (e) {
    console.error("toggleMembershipPlan error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteMembershipPlan(id: string): Promise<ActionResult> {
  let parsed: z.infer<typeof idSchema>
  try {
    parsed = idSchema.parse({ id })
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    const { businessId } = await requireMinRole("admin")

    // Don't orphan members: refuse to hard-delete a plan that still has
    // memberships — deactivate it instead. Scope the delete by businessId.
    const memberCount = await prisma.membership.count({
      where: { planId: parsed.id, plan: { businessId } },
    })
    if (memberCount > 0) {
      return { success: false, error: "Cannot delete a plan with members — deactivate it instead" }
    }

    const { count } = await prisma.membershipPlan.deleteMany({ where: { id: parsed.id, businessId } })
    if (count === 0) return { success: false, error: "Plan not found" }

    revalidatePath("/memberships")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("deleteMembershipPlan error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function createMembership(data: {
  clientId: string
  planId: string
  startDate: Date
}): Promise<ActionResult<{ id: string }>> {
  let parsed: z.infer<typeof createMembershipSchema>
  try {
    parsed = createMembershipSchema.parse(data)
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const [plan, client] = await Promise.all([
      prisma.membershipPlan.findFirst({ where: { id: parsed.planId, businessId } }),
      prisma.client.findFirst({ where: { id: parsed.clientId, businessId }, select: { id: true } }),
    ])
    if (!plan) return { success: false, error: "Plan not found" }
    if (!client) return { success: false, error: "Client not found" }

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
    return { success: true, data: { id: membership.id } }
  } catch (e) {
    console.error("createMembership error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function cancelMembership(id: string): Promise<ActionResult> {
  let parsed: z.infer<typeof idSchema>
  try {
    parsed = idSchema.parse({ id })
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const { count } = await prisma.membership.updateMany({
      where: { id: parsed.id, plan: { businessId } },
      data: { status: "cancelled_membership", cancelledAt: new Date() },
    })
    if (count === 0) return { success: false, error: "Membership not found" }

    revalidatePath("/memberships")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("cancelMembership error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function pauseMembership(id: string): Promise<ActionResult> {
  let parsed: z.infer<typeof idSchema>
  try {
    parsed = idSchema.parse({ id })
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const { count } = await prisma.membership.updateMany({
      where: { id: parsed.id, plan: { businessId } },
      data: { status: "paused_membership", pausedAt: new Date() },
    })
    if (count === 0) return { success: false, error: "Membership not found" }

    revalidatePath("/memberships")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("pauseMembership error:", e)
    return { success: false, error: (e as Error).message }
  }
}

export async function resumeMembership(id: string): Promise<ActionResult> {
  let parsed: z.infer<typeof idSchema>
  try {
    parsed = idSchema.parse({ id })
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e.issues[0]?.message ?? "Invalid input" }
    throw e
  }

  try {
    const { businessId } = await getBusinessContext()

    const { count } = await prisma.membership.updateMany({
      where: { id: parsed.id, plan: { businessId } },
      data: { status: "active_membership", pausedAt: null },
    })
    if (count === 0) return { success: false, error: "Membership not found" }

    revalidatePath("/memberships")
    return { success: true, data: undefined }
  } catch (e) {
    console.error("resumeMembership error:", e)
    return { success: false, error: (e as Error).message }
  }
}
