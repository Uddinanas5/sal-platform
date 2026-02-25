import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, ERRORS } from "@/lib/api/response"
import { hasRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    include: { locations: { select: { addressLine1: true, city: true, state: true, postalCode: true, phone: true } } },
  })
  if (!business) return ERRORS.NOT_FOUND("Business")

  const location = business.locations[0]
  return apiSuccess({
    id: business.id,
    name: business.name,
    slug: business.slug,
    email: business.email,
    phone: business.phone,
    website: business.website,
    timezone: business.timezone,
    currency: business.currency,
    subscriptionTier: business.subscriptionTier,
    subscriptionStatus: business.subscriptionStatus,
    address: location?.addressLine1,
    city: location?.city,
    state: location?.state,
    zipCode: location?.postalCode,
  })
}

export async function PATCH(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()
  if (!hasRole(ctx.role, "admin")) return ERRORS.FORBIDDEN()

  let body: unknown
  try { body = await req.json() } catch { return ERRORS.BAD_REQUEST("Invalid JSON") }

  const parsed = updateSettingsSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
    },
  })

  if (parsed.data.address || parsed.data.city || parsed.data.state || parsed.data.zipCode) {
    const location = await prisma.location.findFirst({ where: { businessId: ctx.businessId } })
    if (location) {
      await prisma.location.update({
        where: { id: location.id },
        data: {
          addressLine1: parsed.data.address,
          city: parsed.data.city,
          state: parsed.data.state,
          postalCode: parsed.data.zipCode,
        },
      })
    }
  }

  return apiSuccess({ updated: true })
}
