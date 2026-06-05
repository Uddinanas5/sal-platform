import { PrismaClient } from "@/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const url = process.env.DATABASE_URL!
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1')
  const sslmode = isLocal ? 'disable' : 'require'
  const connectionString = url.includes('?')
    ? `${url}&sslmode=${sslmode}&uselibpqcompat=true`
    : `${url}?sslmode=${sslmode}&uselibpqcompat=true`
  // Respect Prisma's ?schema= URL param (node-postgres ignores it natively)
  const schema = /[?&]schema=([^&]+)/.exec(url)?.[1]
  const adapter = new PrismaPg({ connectionString }, schema ? { schema } : undefined)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
