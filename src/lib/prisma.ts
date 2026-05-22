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
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
