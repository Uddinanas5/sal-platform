import { withV1Auth } from "@/lib/api/auth"
import { apiSuccess, apiPaginated, ERRORS } from "@/lib/api/response"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createClientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")))
  const search = url.searchParams.get("search") ?? ""

  const where = {
    businessId: ctx.businessId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
  ])

  return apiPaginated(clients, { page, limit, total })
}

export async function POST(req: Request) {
  const ctx = await withV1Auth(req)
  if (!ctx) return ERRORS.UNAUTHORIZED()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ERRORS.BAD_REQUEST("Invalid JSON")
  }

  const parsed = createClientSchema.safeParse(body)
  if (!parsed.success) return ERRORS.BAD_REQUEST(parsed.error.issues[0]?.message ?? "Invalid input")

  const normalizedEmail = parsed.data.email?.trim().toLowerCase() ?? null

  if (normalizedEmail) {
    const existing = await prisma.client.findFirst({
      where: { businessId: ctx.businessId, email: normalizedEmail },
    })
    if (existing) return ERRORS.BAD_REQUEST("A client with this email already exists")
  }

  const client = await prisma.client.create({
    data: {
      businessId: ctx.businessId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: normalizedEmail,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
      tags: parsed.data.tags ?? [],
    },
  })

  return apiSuccess(client, 201)
}
