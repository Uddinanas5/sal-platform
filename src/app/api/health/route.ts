import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function categorizeError(error: unknown): { category: string; code?: string } {
  if (!(error instanceof Error)) return { category: "unknown" }
  const name = error.name
  const code = (error as { code?: string }).code
  if (name === "PrismaClientInitializationError" || code === "P1001" || code === "P1017") {
    return { category: "db_unreachable", code }
  }
  if (name === "PrismaClientKnownRequestError") {
    return { category: "db_request_error", code }
  }
  if (name === "PrismaClientRustPanicError") {
    return { category: "db_panic", code }
  }
  return { category: "unknown", code }
}

export async function GET() {
  const timestamp = new Date().toISOString()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok", timestamp })
  } catch (error) {
    const { category, code } = categorizeError(error)
    const body: Record<string, unknown> = { status: "error", timestamp, category }
    if (process.env.NODE_ENV !== "production") {
      body.code = code
      body.message = error instanceof Error ? error.message : String(error)
    }
    return NextResponse.json(body, { status: 503 })
  }
}
